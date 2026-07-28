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
        # Formato no reconocido: caemos al nombre de archivo como único dato.
        return FileInfo(title=path.stem, artist="", album="", duration_ms=0)

    title = (audio.get("title") or [path.stem])[0]
    artist = (audio.get("artist") or [""])[0]
    album = (audio.get("album") or [""])[0]
    duration_ms = int((audio.info.length or 0) * 1000) if audio.info else 0

    return FileInfo(title=title, artist=artist, album=album, duration_ms=duration_ms)
