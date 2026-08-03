"""
Lee la metadata actual de un archivo local (MP3, M4A, FLAC) para
alimentar al matcher. Usa mutagen.File() que autodetecta el formato.
"""

from __future__ import annotations

from pathlib import Path

from mutagen import File as MutagenFile

from matcher import FileInfo


def read_file_info(path: str | Path) -> FileInfo:
    path = Path(path)
    audio = MutagenFile(path, easy=True)

    if audio is None:
        return FileInfo(title=path.stem, artist="", album="", duration_ms=0)

    title = (audio.get("title") or [path.stem])[0]
    artist = (audio.get("artist") or [""])[0]
    album = (audio.get("album") or [""])[0]
    duration_ms = int((audio.info.length or 0) * 1000) if audio.info else 0

    return FileInfo(title=title, artist=artist, album=album, duration_ms=duration_ms)


def read_all_tags(path: str | Path) -> dict[str, str]:
    """Read all available metadata tags from a file for manual editing."""
    path = Path(path)
    audio = MutagenFile(path, easy=True)

    if audio is None:
        return {"title": path.stem}

    return {
        "title": (audio.get("title") or [path.stem])[0],
        "artist": (audio.get("artist") or [""])[0],
        "album": (audio.get("album") or [""])[0],
        "year": (audio.get("date") or [""])[0],
        "track": (audio.get("tracknumber") or [""])[0].split("/")[0],
        "disc": (audio.get("discnumber") or [""])[0].split("/")[0],
        "album_artist": (audio.get("albumartist") or [""])[0],
        "genre": (audio.get("genre") or [""])[0],
    }
