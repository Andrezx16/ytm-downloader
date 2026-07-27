"""
Catálogo de Apple vía iTunes Search API — gratuita, sin auth, sin
membresía de developer. Distinta de la Apple Music API (esa sí requiere
JWT firmado + cuenta paga de Apple Developer Program, ver historial de
este proyecto). Para nuestro caso (metadata, no streaming) esta cubre
lo mismo: título, artista, álbum, portada, año, género, duración.

Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
Límite: ~20 llamadas/minuto (no publicado oficialmente, es orientativo).
"""

from __future__ import annotations

import logging

import httpx

from .base import MatchCandidate, MusicProvider

BASE_URL = "https://itunes.apple.com/search"
logger = logging.getLogger(__name__)


class AppleMusicProvider(MusicProvider):
    """
    Nombre de clase se mantiene por compatibilidad con el resto del
    proyecto (source="apple"), aunque técnicamente usa la iTunes Search
    API en vez de la Apple Music API.
    """

    name = "apple"

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)

    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        params = {
            "term": f"{artist} {title}",
            "media": "music",
            "entity": "song",
            "limit": limit,
        }

        try:
            resp = await self._client.get(BASE_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("iTunes/Apple falló: %s", e)
            return []

        data = resp.json()
        candidates: list[MatchCandidate] = []

        for track in data.get("results", []):
            # artworkUrl100 viene en baja resolución por defecto; se puede
            # pedir un tamaño mayor reemplazando el sufijo "100x100".
            cover = track.get("artworkUrl100")
            if cover:
                cover = cover.replace("100x100bb", "600x600bb")

            candidates.append(
                self._empty_candidate(
                    source_id=str(track.get("trackId")) if track.get("trackId") else None,
                    title=track.get("trackName", ""),
                    artist=track.get("artistName", ""),
                    album=track.get("collectionName", ""),
                    album_artist=track.get("artistName"),
                    year=_extract_year(track.get("releaseDate")),
                    genre=track.get("primaryGenreName"),
                    track_number=track.get("trackNumber"),
                    disc_number=track.get("discNumber"),
                    cover_url=cover,
                    duration_ms=track.get("trackTimeMillis") or 0,
                )
            )

        return candidates

    async def aclose(self) -> None:
        await self._client.aclose()


def _extract_year(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        return int(date_str.split("-")[0])
    except ValueError:
        return None