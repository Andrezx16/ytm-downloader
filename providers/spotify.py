"""
Spotify: requiere credenciales de una app registrada en
https://developer.spotify.com/dashboard (gratis de crear).

Usa el flujo "Client Credentials" (sin login de usuario, solo para
lectura de catálogo público) — suficiente para búsqueda de metadata.
Docs: https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow

STUB EN LA PRÁCTICA — NO INCLUIDO EN LA LISTA DE PROVIDERS ACTIVOS.
Desde el 11 de febrero de 2026, Spotify exige que el dueño de la app
tenga una cuenta Premium para usar Development Mode (antes solo lo
exigían para endpoints de playback, ahora aplica a toda la API,
incluida la búsqueda de catálogo que usa este módulo). Ver:
https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security

El código de abajo es funcional y no necesita cambios — si en algún
momento tenés Premium, alcanza con setear SPOTIFY_CLIENT_ID y
SPOTIFY_CLIENT_SECRET y agregar SpotifyProvider() a la lista de
providers en api.py. Hasta entonces, el proyecto corre solo con
Deezer + MusicBrainz (y Apple Music si se implementa a futuro).
"""

from __future__ import annotations

import os
import time

import httpx

from .base import MatchCandidate, MusicProvider

TOKEN_URL = "https://accounts.spotify.com/api/token"
API_BASE = "https://api.spotify.com/v1"


class SpotifyProvider(MusicProvider):
    name = "spotify"

    def __init__(self, client_id: str | None = None, client_secret: str | None = None) -> None:
        self._client_id = client_id or os.environ.get("SPOTIFY_CLIENT_ID", "")
        self._client_secret = client_secret or os.environ.get("SPOTIFY_CLIENT_SECRET", "")
        self._client = httpx.AsyncClient(timeout=10.0)
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    async def _get_token(self) -> str | None:
        if self._token and time.time() < self._token_expires_at:
            return self._token

        if not self._client_id or not self._client_secret:
            return None

        try:
            resp = await self._client.post(
                TOKEN_URL,
                data={"grant_type": "client_credentials"},
                auth=(self._client_id, self._client_secret),
            )
            resp.raise_for_status()
        except httpx.HTTPError:
            return None

        data = resp.json()
        self._token = data["access_token"]
        # Restamos 60s de margen de seguridad antes de que expire.
        self._token_expires_at = time.time() + data.get("expires_in", 3600) - 60
        return self._token

    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        token = await self._get_token()
        if not token:
            return []

        params = {"q": f'track:"{title}" artist:"{artist}"', "type": "track", "limit": limit}
        headers = {"Authorization": f"Bearer {token}"}

        try:
            resp = await self._client.get(f"{API_BASE}/search", params=params, headers=headers)
            resp.raise_for_status()
        except httpx.HTTPError:
            return []

        data = resp.json()
        candidates: list[MatchCandidate] = []

        for track in data.get("tracks", {}).get("items", []):
            album = track.get("album", {})
            images = album.get("images", [])

            candidates.append(
                self._empty_candidate(
                    title=track.get("name", ""),
                    artist=", ".join(a["name"] for a in track.get("artists", [])),
                    album=album.get("name", ""),
                    album_artist=(album.get("artists") or [{}])[0].get("name"),
                    year=_extract_year(album.get("release_date")),
                    isrc=track.get("external_ids", {}).get("isrc"),
                    cover_url=images[0]["url"] if images else None,
                    duration_ms=track.get("duration_ms") or 0,
                    track_number=track.get("track_number"),
                    disc_number=track.get("disc_number"),
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