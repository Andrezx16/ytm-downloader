"""
Escribe la metadata final (venga de un candidato de API, editada a mano,
o una mezcla) al archivo de audio. Soporta MP3 (ID3), M4A/AAC (MP4) y
FLAC (Vorbis comments) — cada formato tiene su propio esquema de tags,
así que no se puede usar `easy=True` de mutagen para todo (no cubre
portada, ISRC, compositor, etc.).

Recibe un dict simple (no necesariamente un MatchCandidate completo,
porque el usuario puede haber editado campos a mano en la UI).
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, TypedDict

import httpx
from mutagen.flac import FLAC, Picture
from mutagen.id3 import (
    APIC,
    ID3,
    TALB,
    TCOM,
    TCON,
    TDRC,
    TIT2,
    TOPE,
    TPE1,
    TPE2,
    TPOS,
    TPUB,
    TRCK,
    TSRC,
    USLT,
)
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4, MP4Cover


class FinalMetadata(TypedDict, total=False):
    title: str
    artist: str
    album: str
    album_artist: str
    year: int
    genre: str
    track_number: int
    disc_number: int
    isrc: str
    composer: str
    publisher: str
    cover_url: str
    lyrics: str  # texto plano o LRC ya resuelto por lyrics.py


async def _fetch_cover_bytes(cover_url: str) -> Optional[bytes]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(cover_url)
            resp.raise_for_status()
            return resp.content
    except httpx.HTTPError:
        return None


async def write_metadata(path: str | Path, meta: FinalMetadata) -> None:
    path = Path(path)
    suffix = path.suffix.lower()

    cover_bytes = None
    if meta.get("cover_url"):
        cover_bytes = await _fetch_cover_bytes(meta["cover_url"])

    if suffix == ".mp3":
        _write_mp3(path, meta, cover_bytes)
    elif suffix in (".m4a", ".aac", ".mp4"):
        _write_mp4(path, meta, cover_bytes)
    elif suffix == ".flac":
        _write_flac(path, meta, cover_bytes)
    else:
        raise ValueError(f"Formato no soportado: {suffix}")


def _write_mp3(path: Path, meta: FinalMetadata, cover_bytes: Optional[bytes]) -> None:
    audio = MP3(path)
    if audio.tags is None:
        audio.add_tags()
    tags: ID3 = audio.tags  # type: ignore[assignment]

    _set(tags, TIT2, meta.get("title"))
    _set(tags, TPE1, meta.get("artist"))
    _set(tags, TALB, meta.get("album"))
    _set(tags, TPE2, meta.get("album_artist"))
    _set(tags, TCON, meta.get("genre"))
    _set(tags, TCOM, meta.get("composer"))
    _set(tags, TPUB, meta.get("publisher"))
    _set(tags, TSRC, meta.get("isrc"))
    if meta.get("year"):
        tags.setall("TDRC", [TDRC(encoding=3, text=str(meta["year"]))])
    if meta.get("track_number"):
        tags.setall("TRCK", [TRCK(encoding=3, text=str(meta["track_number"]))])
    if meta.get("disc_number"):
        tags.setall("TPOS", [TPOS(encoding=3, text=str(meta["disc_number"]))])
    if meta.get("lyrics"):
        tags.setall("USLT", [USLT(encoding=3, lang="und", desc="", text=meta["lyrics"])])
    if cover_bytes:
        tags.setall(
            "APIC",
            [APIC(encoding=3, mime="image/jpeg", type=3, desc="Cover", data=cover_bytes)],
        )

    audio.save()


def _write_mp4(path: Path, meta: FinalMetadata, cover_bytes: Optional[bytes]) -> None:
    audio = MP4(path)
    tags = audio.tags if audio.tags is not None else {}

    if meta.get("title"):
        tags["\xa9nam"] = [meta["title"]]
    if meta.get("artist"):
        tags["\xa9ART"] = [meta["artist"]]
    if meta.get("album"):
        tags["\xa9alb"] = [meta["album"]]
    if meta.get("album_artist"):
        tags["aART"] = [meta["album_artist"]]
    if meta.get("genre"):
        tags["\xa9gen"] = [meta["genre"]]
    if meta.get("composer"):
        tags["\xa9wrt"] = [meta["composer"]]
    if meta.get("year"):
        tags["\xa9day"] = [str(meta["year"])]
    if meta.get("track_number"):
        tags["trkn"] = [(meta["track_number"], 0)]
    if meta.get("disc_number"):
        tags["disk"] = [(meta["disc_number"], 0)]
    if meta.get("lyrics"):
        tags["\xa9lyr"] = [meta["lyrics"]]
    if cover_bytes:
        tags["covr"] = [MP4Cover(cover_bytes, imageformat=MP4Cover.FORMAT_JPEG)]

    audio.tags = tags
    audio.save()


def _write_flac(path: Path, meta: FinalMetadata, cover_bytes: Optional[bytes]) -> None:
    audio = FLAC(path)

    if meta.get("title"):
        audio["title"] = meta["title"]
    if meta.get("artist"):
        audio["artist"] = meta["artist"]
    if meta.get("album"):
        audio["album"] = meta["album"]
    if meta.get("album_artist"):
        audio["albumartist"] = meta["album_artist"]
    if meta.get("genre"):
        audio["genre"] = meta["genre"]
    if meta.get("composer"):
        audio["composer"] = meta["composer"]
    if meta.get("year"):
        audio["date"] = str(meta["year"])
    if meta.get("track_number"):
        audio["tracknumber"] = str(meta["track_number"])
    if meta.get("disc_number"):
        audio["discnumber"] = str(meta["disc_number"])
    if meta.get("lyrics"):
        audio["lyrics"] = meta["lyrics"]

    if cover_bytes:
        audio.clear_pictures()
        pic = Picture()
        pic.data = cover_bytes
        pic.type = 3
        pic.mime = "image/jpeg"
        audio.add_picture(pic)

    audio.save()


def _set(tags: ID3, frame_cls, value: Optional[str]) -> None:
    if value:
        tags.setall(frame_cls.__name__, [frame_cls(encoding=3, text=value)])
