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
            primary_artist = track.get("artist", {}).get("name", "")
            track_id = track.get("id")

            # Fetch /track/{id} to get full contributor list
            artist_str = primary_artist
            if track_id:
                detail = await self._get_track_detail(track_id)
                if detail:
                    artist_str = detail["artist"]

            candidates.append(
                self._empty_candidate(
                    source_id=str(track_id) if track_id else None,
                    title=track.get("title", ""),
                    artist=artist_str,
                    album=album.get("title", ""),
                    album_artist=primary_artist,
                    cover_url=album.get("cover_xl") or album.get("cover_big"),
                    duration_ms=(track.get("duration") or 0) * 1000,
                )
            )

        return candidates

    async def _get_track_detail(self, track_id: int) -> dict | None:
        """Fetch /track/{id} and return artist string + extra fields."""
        try:
            resp = await self._client.get(f"/track/{track_id}")
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.debug("Deezer _get_track_detail falló para id=%s: %s", track_id, e)
            return None

        data = resp.json()
        contributors = data.get("contributors") or []
        if len(contributors) > 1:
            artist = ", ".join(c.get("name", "") for c in contributors if c.get("name"))
        else:
            artist = data.get("artist", {}).get("name", "")

        return {
            "artist": artist,
            "track_number": data.get("track_position"),
            "disc_number": data.get("disk_number"),
            "isrc": data.get("isrc"),
            "year": _extract_year(data.get("release_date")),
        }

    async def get_full_details(self, track_id: str) -> dict | None:
        """
        Trae detalle completo de UN track por id — incluye track_position,
        disk_number, isrc, year y contributors.
        """
        detail = await self._get_track_detail(int(track_id))
        if not detail:
            return None
        return {
            "track_number": detail["track_number"],
            "disc_number": detail["disc_number"],
            "isrc": detail["isrc"],
            "year": detail["year"],
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