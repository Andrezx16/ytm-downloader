"""
Last.fm: API key gratis, solo registro en https://www.last.fm/api/account/create
No aporta título/artista/álbum tan bien como las otras (usa folksonomía
de usuarios, no catálogo curado), pero es la mejor fuente de género/tags
de todo el set — MusicBrainz suele tener el campo genre vacío.

Estrategia de dos pasos (a diferencia de otras fuentes que resuelven
todo en una sola llamada):

  1. track.search: búsqueda FUZZY por texto, devuelve varios candidatos
     pero con datos pobres (sin álbum, sin tags, sin portada).
  2. track.getInfo: por cada candidato del paso 1, trae los datos
     completos (álbum, tags/género, portada) usando el nombre EXACTO
     que devolvió el search — así evitamos el problema de que
     getInfo con el título tal cual vino del archivo agarre el track
     equivocado (ej: un single suelto en vez de la versión con
     colaboración que está en el álbum real).

Docs: https://www.last.fm/api/show/track.search
      https://www.last.fm/api/show/track.getInfo
Límite: 5 req/s — con 1 search + hasta 3 getInfo por búsqueda, se
respeta con un pequeño sleep entre llamadas de enriquecimiento.
"""

from __future__ import annotations

import asyncio
import logging
import os

import httpx

from .base import MatchCandidate, MusicProvider

BASE_URL = "https://ws.audioscrobbler.com/2.0/"
logger = logging.getLogger(__name__)

# Cuántos candidatos del track.search se enriquecen con getInfo.
# Cada uno cuesta una llamada extra, así que no conviene poner esto
# muy alto — 3 alcanza para darle al matcher opciones sin gastar de más.
MAX_ENRICHED_CANDIDATES = 3


class LastFmProvider(MusicProvider):
    name = "lastfm"

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or os.environ.get("LASTFM_API_KEY", "")
        self._client = httpx.AsyncClient(timeout=10.0)

    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        if not self._api_key:
            logger.warning("Last.fm: falta LASTFM_API_KEY, se omite esta fuente")
            return []

        matches = await self._search_tracks(title, artist, limit)
        if not matches:
            logger.warning("Last.fm: sin resultados de track.search para '%s' - '%s'", artist, title)
            return []

        candidates: list[MatchCandidate] = []
        for match in matches[:MAX_ENRICHED_CANDIDATES]:
            info = await self._get_track_info(match["name"], match["artist"])
            if info is not None:
                candidates.append(info)
            # Pequeño respiro entre llamadas de enriquecimiento para no
            # pasarse del límite de 5 req/s de Last.fm.
            await asyncio.sleep(0.25)

        return candidates

    async def _search_tracks(self, title: str, artist: str, limit: int) -> list[dict]:
        params = {
            "method": "track.search",
            "api_key": self._api_key,
            "track": title,
            "artist": artist,
            "format": "json",
            "limit": limit,
        }

        try:
            resp = await self._client.get(BASE_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Last.fm track.search falló: %s", e)
            return []

        data = resp.json()
        matches = data.get("results", {}).get("trackmatches", {}).get("track", [])
        # Last.fm a veces devuelve un dict pelado en vez de lista cuando
        # hay un solo resultado — normalizamos a lista siempre.
        if isinstance(matches, dict):
            matches = [matches]
        return matches

    async def _get_track_info(self, name: str, artist: str) -> MatchCandidate | None:
        params = {
            "method": "track.getInfo",
            "api_key": self._api_key,
            "artist": artist,
            "track": name,
            "format": "json",
        }

        try:
            resp = await self._client.get(BASE_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Last.fm track.getInfo falló para '%s' - '%s': %s", artist, name, e)
            return None

        data = resp.json()

        # OJO: Last.fm devuelve HTTP 200 incluso cuando no encuentra el
        # track — el error viene en el body, no en el status code.
        if "error" in data:
            logger.warning(
                "Last.fm: getInfo sin match (error %s: %s) para '%s' - '%s'",
                data.get("error"), data.get("message"), artist, name,
            )
            return None

        track = data.get("track")
        if not track:
            return None

        album = track.get("album") or {}
        images = album.get("image") or []
        cover_url = next((img["#text"] for img in reversed(images) if img.get("#text")), None)

        tags = track.get("toptags", {}).get("tag", [])
        genre = tags[0]["name"] if tags else None

        return self._empty_candidate(
            title=track.get("name", ""),
            artist=track.get("artist", {}).get("name", ""),
            album=album.get("title", ""),
            genre=genre,
            cover_url=cover_url,
            duration_ms=int(track.get("duration") or 0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()