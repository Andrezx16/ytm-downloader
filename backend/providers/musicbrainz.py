"""
MusicBrainz: base de datos comunitaria, gratuita, sin API key.

IMPORTANTE: su política de uso EXIGE un User-Agent identificable con
nombre de app + versión + contacto. Sin esto pueden banear tu IP.
Docs: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
Límite: 1 request/segundo por IP (aplicado abajo con un lock simple).
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from .base import MatchCandidate, MusicProvider

BASE_URL = "https://musicbrainz.org/ws/2"
logger = logging.getLogger(__name__)

# Cambiá esto por datos reales antes de usarlo en producción.
USER_AGENT = "MusicMetadataManager/0.1 (contacto@tudominio.com)"


class MusicBrainzProvider(MusicProvider):
    name = "musicbrainz"

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=10.0,
        )

    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        query = f'recording:"{title}" AND artist:"{artist}"'
        # inc=media: sin esto, MusicBrainz no manda la posición del track
        # dentro del álbum aunque la tenga en su base de datos.
        params = {"query": query, "fmt": "json", "limit": limit, "inc": "media"}

        try:
            # Respeta el rate limit de 1 req/s de MusicBrainz.
            # El sleep DENTRO del lock asegura que no se slippear requests.
            async with self._lock:
                resp = await self._client.get("/recording", params=params)
                await asyncio.sleep(1.0)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("MusicBrainz falló: %s", e)
            return []

        data = resp.json()
        candidates: list[MatchCandidate] = []

        for rec in data.get("recordings", []):
            release = (rec.get("releases") or [{}])[0]
            artist_credit = rec.get("artist-credit") or [{}]
            track_number, disc_number = _extract_track_position(release, rec.get("id"))

            candidates.append(
                self._empty_candidate(
                    source_id=rec.get("id"),
                    title=rec.get("title", ""),
                    artist=artist_credit[0].get("name", ""),
                    album=release.get("title", ""),
                    year=_extract_year(release.get("date")),
                    isrc=(rec.get("isrcs") or [None])[0],
                    duration_ms=rec.get("length") or 0,
                    track_number=track_number,
                    disc_number=disc_number,
                )
            )

        return candidates

    async def aclose(self) -> None:
        await self._client.aclose()


def _extract_track_position(
    release: dict, recording_id: str | None
) -> tuple[int | None, int | None]:
    """
    Busca, dentro de los medios (discos) del release, el track cuyo id
    de grabación coincide con el recording actual, y devuelve su
    (número de pista, número de disco). Requiere que la búsqueda se
    haya hecho con inc=media.
    """
    for disc_index, medium in enumerate(release.get("media") or [], start=1):
        for track in medium.get("tracks") or medium.get("track") or []:
            if track.get("recording", {}).get("id") == recording_id or track.get("id") == recording_id:
                try:
                    return int(track.get("number")), disc_index
                except (TypeError, ValueError):
                    return None, disc_index
    return None, None


def _extract_year(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        return int(date_str.split("-")[0])
    except ValueError:
        return None