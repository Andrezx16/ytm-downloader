"""
Spotify: datos públicos sin API key usando spotifyscraper.

El token anónimo se obtiene de las páginas embed de Spotify, sin necesidad
de credenciales ni cuenta Premium. Docs: https://spotifyscraper.readthedocs.io
"""

from __future__ import annotations

import logging

from spotify_scraper import AsyncSpotifyClient

from .base import MatchCandidate, MusicProvider

logger = logging.getLogger(__name__)


class SpotifyProvider(MusicProvider):
    name = "spotify"

    def __init__(self) -> None:
        self._client = AsyncSpotifyClient(timeout=10.0)

    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        try:
            results = await self._client.search(
                f"{title} {artist}",
                types=("track",),
                limit=limit,
            )
        except Exception as e:
            logger.warning("Spotify falló: %s", e)
            return []

        candidates: list[MatchCandidate] = []

        for track in results.tracks:
            album = track.album
            artists = ", ".join(a.name for a in track.artists if a.name)

            candidate = self._empty_candidate(
                source_id=track.id,
                title=track.name,
                artist=artists,
                album=album.name if album else "",
                album_artist=artists.split(", ")[0] if artists else None,
                year=_extract_year(track.release_date),
                cover_url=_best_image(track),
                duration_ms=track.duration_ms,
                track_number=track.track_number,
            )

            # Enrich with get_track() for fields missing from search results
            if track.track_number is None or track.release_date is None:
                try:
                    full = await self._client.get_track(track.id)
                    if full:
                        if candidate["track_number"] is None and full.track_number is not None:
                            candidate["track_number"] = full.track_number
                        if candidate["year"] is None:
                            candidate["year"] = _extract_year(full.release_date)
                except Exception as e:
                    logger.debug("Spotify get_track falló para id=%s: %s", track.id, e)

            candidates.append(candidate)

        return candidates

    async def get_full_details(self, track_id: str) -> dict | None:
        try:
            track = await self._client.get_track(track_id)
        except Exception as e:
            logger.debug("Spotify get_track falló para id=%s: %s", track_id, e)
            return None

        album = track.album
        return {
            "track_number": track.track_number,
            "disc_number": None,
            "isrc": None,
            "year": _extract_year(track.release_date),
        }

    async def aclose(self) -> None:
        await self._client.aclose()


def _extract_year(date) -> int | None:
    if date is None:
        return None
    try:
        return date.year
    except AttributeError:
        pass
    if isinstance(date, str):
        try:
            return int(date.split("-")[0])
        except (ValueError, IndexError):
            return None
    return None


def _best_image(track) -> str | None:
    images = track.images
    if not images:
        return None
    best = max(
        images,
        key=lambda img: (getattr(img, "width", 0) or 0) * (getattr(img, "height", 0) or 0),
    )
    return best.url if hasattr(best, "url") else str(best)
