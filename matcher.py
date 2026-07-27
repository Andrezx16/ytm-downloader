"""
Orquesta los providers y calcula la confianza de cada candidato según:

    confianza = 0.4*sim(titulo) + 0.3*sim(artista) + 0.2*sim(duracion) + 0.1*sim(album)

Umbral sugerido: >= 0.9 -> "recomendado" (preseleccionado en la UI).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from rapidfuzz import fuzz

from providers.base import MatchCandidate, MusicProvider

logger = logging.getLogger(__name__)

WEIGHTS = {"title": 0.4, "artist": 0.3, "duration": 0.2, "album": 0.1}
DURATION_TOLERANCE_MS = 10_000  # 10s de margen
RECOMMENDED_THRESHOLD = 0.9


@dataclass
class FileInfo:
    """Metadata leída del archivo local (por extractor.py) contra la que se compara."""

    title: str
    artist: str
    album: str = ""
    duration_ms: int = 0


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


async def find_matches(
    file_info: FileInfo,
    providers: list[MusicProvider],
    limit_per_provider: int = 5,
) -> list[MatchCandidate]:
    """
    Dispara todos los providers en paralelo, calcula confianza para cada
    candidato devuelto, y retorna la lista completa ordenada de mayor a
    menor confianza. Si un provider falla, simplemente no aporta
    candidatos — no rompe el resto.
    """
    results = await asyncio.gather(
        *(p.search(file_info.title, file_info.artist, limit_per_provider) for p in providers),
        return_exceptions=True,
    )

    all_candidates: list[MatchCandidate] = []
    for provider, result in zip(providers, results):
        if isinstance(result, Exception):
            logger.warning("%s tiró una excepción no manejada: %r", provider.name, result)
            continue
        logger.info("%s devolvió %d candidato(s)", provider.name, len(result))
        for candidate in result:
            candidate["confidence"] = round(score_candidate(file_info, candidate), 4)
            all_candidates.append(candidate)

    all_candidates.sort(key=lambda c: c["confidence"] or 0.0, reverse=True)
    return all_candidates


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

    for field in FILLABLE_FIELDS:
        if merged.get(field) is not None:
            continue
        for other in others:
            value = other.get(field)
            if value is not None and value != "":
                merged[field] = value  # type: ignore[literal-required]
                break

    return merged