"""
YT Music como provider normal — participa en el matching fuzzy igual
que Deezer/MusicBrainz/Apple/Last.fm, comparado por matcher.score_candidate().

Usa ytmusicapi (NO oficial, envuelve el API interno privado de YT
Music) — mismo enfoque que ya usás en tu proyecto de sync YT Music ->
Spotify. Puede romperse si Google cambia su API interna sin aviso.

Nota sobre calidad de datos: YT Music no es un catálogo curado como
Spotify/Deezer — el álbum a veces viene vacío (sobre todo en uploads
que no son "Songs" oficiales), y el artista puede venir mezclado con
"Topic" en canales autogenerados. El matcher lo compensa: si estos
campos vienen pobres, el score de confianza baja solo y el candidato
compite en igualdad de condiciones con los demás, no se prioriza.
"""

from __future__ import annotations

import asyncio

from ytmusicapi import YTMusic

from .base import MatchCandidate, MusicProvider


class YTMusicProvider(MusicProvider):
    name = "ytmusic"

    def __init__(self) -> None:
        # Sin auth: alcanza para búsqueda de catálogo público.
        self._client = YTMusic()

    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        query = f"{artist} {title}".strip()

        try:
            results = await asyncio.to_thread(
                self._client.search, query, filter="songs", limit=limit
            )
        except Exception:
            return []

        candidates: list[MatchCandidate] = []

        for item in results:
            artists = item.get("artists") or []
            album = item.get("album") or {}
            thumbnails = item.get("thumbnails") or []

            candidates.append(
                self._empty_candidate(
                    title=item.get("title", ""),
                    artist=", ".join(a["name"] for a in artists if a.get("name")),
                    album=album.get("name", ""),
                    cover_url=thumbnails[-1]["url"] if thumbnails else None,
                    duration_ms=int(item.get("duration_seconds") or 0) * 1000,
                    # video_id se guarda para que downloader/writer puedan
                    # usarlo después (ej: re-verificar contra el archivo
                    # original si vino de yt-dlp), aunque MatchCandidate
                    # no tiene un campo dedicado: se puede recuperar de
                    # item["videoId"] si en el futuro se agrega al esquema.
                )
            )

        return candidates

    async def aclose(self) -> None:
        pass