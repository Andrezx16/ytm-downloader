"""
Busca letras (sincronizadas si existen, si no plano) usando syncedlyrics,
que ya resuelve el fallback entre LRCLIB, NetEase, Musixmatch y Megalobiz.
"""

from __future__ import annotations

import asyncio

import syncedlyrics

# Orden: LRCLIB primero por ser estable y sin scraping; el resto como
# respaldo. Ajustable según qué tan seguido falle cada uno en tu librería.
PROVIDER_ORDER = ["Lrclib", "Musixmatch", "NetEase", "Megalobiz"]


async def get_lyrics(title: str, artist: str) -> str | None:
    """
    syncedlyrics es sincrónico (bloqueante) por dentro, así que lo
    corremos en un thread aparte para no bloquear el event loop del backend.
    """
    def _search() -> str | None:
        return syncedlyrics.search(f"{title} {artist}", providers=PROVIDER_ORDER)

    return await asyncio.to_thread(_search)
