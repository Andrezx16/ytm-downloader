"""
Orquesta los providers y calcula la confianza de cada candidato según:

    confianza = 0.4*sim(titulo) + 0.3*sim(artista) + 0.2*sim(duracion) + 0.1*sim(album)

Umbral sugerido: >= 0.9 -> "recomendado" (preseleccionado en la UI).
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from rapidfuzz import fuzz

from providers.base import MatchCandidate, MusicProvider

logger = logging.getLogger(__name__)

WEIGHTS = {"title": 0.4, "artist": 0.3, "duration": 0.2, "album": 0.1}
DURATION_TOLERANCE_MS = 10_000  # 10s de margen
RECOMMENDED_THRESHOLD = 0.9

# Per-provider limits: (query_limit, min_results_for_fallback)
_PROVIDER_LIMITS: dict[str, tuple[int, int]] = {
    "deezer": (1, 1),
    "apple": (1, 1),
    "lastfm": (3, 3),
    "musicbrainz": (3, 3),
}
_DEFAULT_PROVIDER_LIMITS = (5, 1)

MERGE_MIN_CONFIDENCE = 0.550

_NOISE_SEPARATORS = re.compile(r"\s*[,;/&]\s*")
_MULTI_ARTIST_SEP = re.compile(r"\s*[&,+]\s*")
_NOISE_SUFFIX = re.compile(
    r"\s*[-\u2013\u2014]\s*(?:written?(?:\s+officially)?\s+by|writer\s*[:\u2013\u2014]|composed?\s+by|composer\s*[:\u2013\u2014]|produced?\s+by|producer\s*[:\u2013\u2014]).*$",
    re.IGNORECASE,
)
_NOISE_SUFFIX_BRACKET = re.compile(
    r"\s*[\(\[][?\w\s]*(?:written\s+by|composed\s+by|produced\s+by|written\sofficially|official(?:ly)?\s+(?:by|video|audio|music\s*video))[\)\]]?\s*$",
    re.IGNORECASE,
)
_FEATURED_PATTERN = re.compile(
    r"\s*[\(\[](.*?(?:feat\.?|ft\.?|featuring).*?)[\)\]]",
    re.IGNORECASE,
)
_SUFFIX_NOISE = re.compile(
    r"\s*[\(\[](?:original|remix|version|live|acoustic|radio|edit|deluxe|explicit|clean|mono|stereo|remastered|remaster|single|album|bonus)[\)\]]?\s*$",
    re.IGNORECASE,
)


@dataclass
class FileInfo:
    """Metadata leída del archivo local (por extractor.py) contra la que se compara."""

    title: str
    artist: str
    album: str = ""
    duration_ms: int = 0


def _normalize_artist(raw: str | None) -> str:
    """Clean noisy artist tags commonly found in YouTube Music files.

    - Strips songwriter/composer credits accidentally stored in artist
      (e.g. "Artist - Writer: Someone" → "Artist").
    - Preserves featured artists in standard positions.
    - Collapses repeated separators.
    - Falls back to original when cleaning leaves nothing meaningful.
    """
    if not raw:
        return ""

    text = raw.strip()
    if not text:
        return ""

    cleaned = _NOISE_SUFFIX.sub("", text).strip()
    if cleaned:
        text = cleaned

    cleaned = _NOISE_SUFFIX_BRACKET.sub("", text).strip()
    if cleaned:
        text = cleaned

    for pattern in (_SUFFIX_NOISE,):
        cleaned = pattern.sub("", text).strip()
        if cleaned and cleaned.lower() != text.lower():
            text = cleaned
            break

    parts = [p.strip() for p in _NOISE_SEPARATORS.split(text) if p.strip()]
    if not parts:
        return raw.strip()

    noisy_prefixes = re.compile(
        r"^(?:writer|written|composer|composed|producer|produced|remixed?\s+by|arranged?\s+by):\s*",
        re.IGNORECASE,
    )
    filtered = [p for p in parts if not noisy_prefixes.match(p)]

    if not filtered:
        return parts[0] if parts else raw.strip()

    seen: set[str] = set()
    deduped: list[str] = []
    for part in filtered:
        key = part.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(part)

    return ", ".join(deduped)


def _string_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return fuzz.token_sort_ratio(a.lower(), b.lower()) / 100.0


def _duration_similarity(a_ms: int, b_ms: int) -> float:
    if not a_ms or not b_ms:
        return 0.0
    diff = abs(a_ms - b_ms)
    return max(0.0, 1.0 - diff / DURATION_TOLERANCE_MS)


def score_candidate(file_info: FileInfo, candidate: MatchCandidate) -> float:
    s_title = _string_similarity(file_info.title, candidate["title"])
    s_artist = _string_similarity(file_info.artist, candidate["artist"])
    s_duration = _duration_similarity(file_info.duration_ms, candidate["duration_ms"])
    s_album = _string_similarity(file_info.album, candidate["album"])

    return (
        WEIGHTS["title"] * s_title
        + WEIGHTS["artist"] * s_artist
        + WEIGHTS["duration"] * s_duration
        + WEIGHTS["album"] * s_album
    )


async def _query_single_provider(
    provider: MusicProvider,
    title: str,
    artist: str,
    limit: int,
) -> list[MatchCandidate]:
    """Query a single provider, returning raw candidates."""
    try:
        return await provider.search(title, artist, limit)
    except Exception as e:
        logger.warning("%s tiró una excepción no manejada: %r", provider.name, e)
        return []


async def _query_provider_with_fallback(
    provider: MusicProvider,
    title: str,
    normalized_artist: str,
    limit: int,
    artist_parts: list[str],
    min_results: int = 3,
) -> list[MatchCandidate]:
    """Query a single provider with bounded fallback.

    1. Full artist query.
    2. If < min_results and multi-artist, try ONLY the primary artist.
    """
    results = await _query_single_provider(provider, title, normalized_artist, limit)
    if len(results) >= min_results:
        return results

    logger.info(
        "%s devolvió %d candidato(s) < %d; intentando fallback con artista principal",
        provider.name, len(results), min_results,
    )

    if len(artist_parts) > 1:
        primary = artist_parts[0]
        part_results = await _query_single_provider(provider, title, primary, limit)
        results.extend(part_results)

    return results


async def find_matches(
    file_info: FileInfo,
    providers: list[MusicProvider],
) -> list[MatchCandidate]:
    """
    Dispara todos los providers en paralelo con fallback por provider:
    si un provider devuelve menos de ``min_results`` candidatos, se reintenta
    con cada artista por separado (si hay múltiples). Calcula confianza para
    cada candidato y retorna la lista completa ordenada de mayor a menor
    confianza.
    """
    normalized_artist = _normalize_artist(file_info.artist)
    artist_parts = [a.strip() for a in _MULTI_ARTIST_SEP.split(normalized_artist) if a.strip()]

    results = await asyncio.gather(
        *(
            _query_provider_with_fallback(
                p, file_info.title, normalized_artist,
                limit=_PROVIDER_LIMITS.get(p.name, _DEFAULT_PROVIDER_LIMITS)[0],
                artist_parts=artist_parts,
                min_results=_PROVIDER_LIMITS.get(p.name, _DEFAULT_PROVIDER_LIMITS)[1],
            )
            for p in providers
        ),
        return_exceptions=True,
    )

    raw: list[MatchCandidate] = []
    for provider, result in zip(providers, results):
        if isinstance(result, Exception):
            logger.warning("%s tiró una excepción no manejada: %r", provider.name, result)
            continue
        logger.info("%s devolvió %d candidato(s) en total", provider.name, len(result))
        raw.extend(result)

    if not raw:
        return []

    return _score_and_sort(file_info, raw)


async def find_matches_stream(
    file_info: FileInfo,
    providers: list[MusicProvider],
) -> AsyncGenerator[dict, None]:
    """
    Like find_matches but yields events as each provider completes.

    Yields dicts with:
      {"event": "provider", "source": name, "matches": [...], "elapsed_time": float}
      {"event": "complete", "all_matches": [...], "elapsed_time": float}

    Uses asyncio.wait instead of as_completed to avoid unawaited
    wrapper coroutine warnings.
    """
    started = time.perf_counter()
    normalized_artist = _normalize_artist(file_info.artist)
    artist_parts = [a.strip() for a in _MULTI_ARTIST_SEP.split(normalized_artist) if a.strip()]

    tasks: dict[asyncio.Task, str] = {}
    for p in providers:
        task = asyncio.create_task(
            _query_provider_with_fallback(
                p, file_info.title, normalized_artist,
                limit=_PROVIDER_LIMITS.get(p.name, _DEFAULT_PROVIDER_LIMITS)[0],
                artist_parts=artist_parts,
                min_results=_PROVIDER_LIMITS.get(p.name, _DEFAULT_PROVIDER_LIMITS)[1],
            )
        )
        tasks[task] = p.name

    raw: list[MatchCandidate] = []
    pending = set(tasks.keys())

    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            name = tasks[task]
            try:
                result = task.result()
                logger.info("%s devolvió %d candidato(s) (stream)", name, len(result))
                raw.extend(result)
                yield {
                    "event": "provider",
                    "source": name,
                    "matches": result,
                    "elapsed_time": time.perf_counter() - started,
                }
            except Exception as exc:
                logger.warning("%s tiró una excepción no manejada (stream): %r", name, exc)
                yield {
                    "event": "provider",
                    "source": name,
                    "matches": [],
                    "elapsed_time": time.perf_counter() - started,
                }

    scored = _score_and_sort(file_info, raw) if raw else []
    yield {
        "event": "complete",
        "all_matches": scored,
        "elapsed_time": time.perf_counter() - started,
    }


def _score_and_sort(file_info: FileInfo, candidates: list[MatchCandidate]) -> list[MatchCandidate]:
    for c in candidates:
        c["confidence"] = round(score_candidate(file_info, c), 4)
    candidates.sort(key=lambda c: c["confidence"] or 0.0, reverse=True)
    return candidates


def best_match_is_recommended(candidates: list[MatchCandidate]) -> bool:
    """True si el mejor candidato supera el umbral de auto-recomendación."""
    if not candidates:
        return False
    return (candidates[0]["confidence"] or 0.0) >= RECOMMENDED_THRESHOLD


# Campos que tiene sentido completar desde otra fuente cuando el
# candidato elegido los trae en None. "title"/"artist"/"source"/
# "source_id"/"confidence" quedan afuera a propósito: esos son la
# identidad del candidato elegido, no algo a "completar".
FILLABLE_FIELDS = [
    "album",
    "album_artist",
    "year",
    "genre",
    "track_number",
    "disc_number",
    "isrc",
    "composer",
    "duration_ms",
    "cover_url",
]


def merge_missing_fields(
    chosen: MatchCandidate, all_candidates: list[MatchCandidate]
) -> MatchCandidate:
    """
    Completa los campos en None del candidato elegido usando los demás
    candidatos que ya se encontraron en la misma búsqueda (ordenados por
    confianza) — sin hacer ninguna llamada de red adicional, porque esa
    info ya la tenemos.

    Ej: elegiste el candidato de Last.fm (sin track_number, sin isrc) y
    el de MusicBrainz de la misma búsqueda sí los tiene -> se copian de
    ahí. Si ninguno de los demás lo tiene tampoco, el campo se deja en
    None (no hay de dónde sacarlo sin una llamada extra a una API con
    detalle, como el caso puntual de Deezer).
    """
    merged: MatchCandidate = dict(chosen)  # type: ignore[assignment]
    others = [c for c in all_candidates if c is not chosen]

    # Upgrade artist if another candidate has a superset of the same artists
    # (e.g. chosen="Pressure 9X19", other="Pressure 9X19, YOVNGCHIMI")
    chosen_artist = (merged.get("artist") or "").strip().lower()
    if chosen_artist:
        chosen_tokens = set(chosen_artist.split(","))
        for other in others:
            if (other.get("confidence") or 0.0) < MERGE_MIN_CONFIDENCE:
                continue
            other_artist = (other.get("artist") or "").strip().lower()
            if not other_artist or other_artist == chosen_artist:
                continue
            other_tokens = set(other_artist.split(","))
            # Upgrade if other contains all chosen tokens AND has extras
            if chosen_tokens < other_tokens:
                merged["artist"] = other["artist"]  # type: ignore[literal-required]
                break

    for field in FILLABLE_FIELDS:
        current = merged.get(field)
        if current is not None and current != "":
            continue
        for other in others:
            if (other.get("confidence") or 0.0) < MERGE_MIN_CONFIDENCE:
                continue
            value = other.get(field)
            if value is not None and value != "":
                merged[field] = value  # type: ignore[literal-required]
                break

    return merged