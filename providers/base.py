"""
Interfaz común para todas las fuentes de metadata (Spotify, Deezer, Apple, MusicBrainz).

Cada provider concreto implementa `search()` y devuelve una lista de
`MatchCandidate` sin el campo `confidence` calculado (eso lo hace el
matcher, no el provider — un provider no sabe compararse contra el
archivo original).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal, Optional, TypedDict


SourceName = Literal["spotify", "deezer", "apple", "musicbrainz", "lastfm", "ytmusic"]


class MatchCandidate(TypedDict):
    source: SourceName
    # Id interno del provider para este resultado (ej: id de Deezer,
    # MBID de MusicBrainz). Sirve para pedir detalles adicionales
    # después, sin tener que volver a buscar por texto. Opcional porque
    # no todas las fuentes lo necesitan/tienen.
    source_id: Optional[str]
    title: str
    artist: str
    album: str
    album_artist: Optional[str]
    year: Optional[int]
    genre: Optional[str]
    track_number: Optional[int]
    disc_number: Optional[int]
    isrc: Optional[str]
    composer: Optional[str]
    duration_ms: int
    cover_url: Optional[str]
    # Se llena después, en el matcher — no aquí.
    confidence: Optional[float]


class MusicProvider(ABC):
    """Contrato que debe cumplir cada fuente de metadata."""

    name: SourceName

    @abstractmethod
    async def search(self, title: str, artist: str, limit: int = 5) -> list[MatchCandidate]:
        """
        Busca coincidencias para (title, artist) y devuelve hasta `limit`
        candidatos SIN el campo `confidence` calculado (se deja en None).
        Nunca debe lanzar excepción hacia afuera por fallas de red: en ese
        caso debe loguear y devolver [] para que el matcher siga con las
        demás fuentes.
        """
        raise NotImplementedError

    def _empty_candidate(self, **overrides) -> MatchCandidate:
        """Helper para construir un candidato con defaults en None."""
        base: MatchCandidate = {
            "source": self.name,
            "source_id": None,
            "title": "",
            "artist": "",
            "album": "",
            "album_artist": None,
            "year": None,
            "genre": None,
            "track_number": None,
            "disc_number": None,
            "isrc": None,
            "composer": None,
            "duration_ms": 0,
            "cover_url": None,
            "confidence": None,
        }
        base.update(overrides)  # type: ignore[typeddict-item]
        return base