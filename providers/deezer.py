"""
Deezer: API pública de solo lectura, sin necesidad de API key para /search.
Docs: https://developers.deezer.com/api/search
"""

from __future__ import annotations

import logging

import httpx

from .base import MatchCandidate, MusicProvider

BASE_URL = "https://api.deezer.com"
logger = logging.getLogger(__name__)


class DeezerProvider(MusicProvider):
    name = "deezer"

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(base_url=BASE_URL, timeout=10.0)

    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        params = {"q": f'track:"{title}" artist:"{artist}"', "limit": limit}

        try:
            resp = await self._client.get("/search", params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Deezer falló: %s", e)
            return []

        data = resp.json()
        candidates: list[MatchCandidate] = []

        for track in data.get("data", []):
            album = track.get("album", {})
            candidates.append(
                self._empty_candidate(
                    source_id=str(track.get("id")) if track.get("id") else None,
                    title=track.get("title", ""),
                    artist=track.get("artist", {}).get("name", ""),
                    album=album.get("title", ""),
                    album_artist=track.get("artist", {}).get("name"),
                    cover_url=album.get("cover_xl") or album.get("cover_big"),
                    duration_ms=(track.get("duration") or 0) * 1000,
                    # NOTA: track_position/disk_number NO vienen en /search,
                    # solo en el endpoint de detalle — ver get_full_details().
                )
            )

        return candidates

    async def get_full_details(self, track_id: str) -> dict | None:
        """
        Trae detalle completo de UN track por id — incluye track_position,
        disk_number e isrc, que /search no devuelve. Pensado para llamarse
        solo sobre el candidato que el usuario ya eligió, no sobre los 5
        resultados de cada búsqueda (evita gastar llamadas de más).
        """
        try:
            resp = await self._client.get(f"/track/{track_id}")
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Deezer get_full_details falló para id=%s: %s", track_id, e)
            return None

        data = resp.json()
        return {
            "track_number": data.get("track_position"),
            "disc_number": data.get("disk_number"),
            "isrc": data.get("isrc"),
            "year": _extract_year(data.get("release_date")),
        }

    async def aclose(self) -> None:
        await self._client.aclose()


def _extract_year(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        return int(date_str.split("-")[0])
    except ValueError:
        return None