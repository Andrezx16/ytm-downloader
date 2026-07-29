"""
Ejemplo:
  python test_download.py
  Buscar: believer
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from downloader import YoutubeDownloader


def progress(p):
    status = getattr(p, "status", "?")
    percent = getattr(p, "percent", None)
    speed = getattr(p, "speed", None)

    if percent is None:
        print(f"\r{status:15}", end="")
    else:
        if speed:
            print(f"\r{status:15} {percent:6.2f}%  {speed}", end="")
        else:
            print(f"\r{status:15} {percent:6.2f}%", end="")


def main():
    dl = YoutubeDownloader()

    print("=" * 70)
    print("DOWNLOADER TEST")
    print("=" * 70)

    query = input("\nBuscar: ").strip()

    print("\nFiltro:")
    print("1. Songs")
    print("2. Videos")
    print("3. All")

    option = input("\nOpción: ").strip()

    filters = {
        "1": "songs",
        "2": "videos",
        "3": "all",
    }

    search_filter = filters.get(option, "songs")

    print("\nBuscando...\n")

    results = dl.search(
        query,
        limit=10,
        filter=search_filter,
    )

    if not results:
        print("No se encontraron resultados.")
        return

    print("-" * 70)

    for i, song in enumerate(results, start=1):
        print(f"{i}. {song.title}")
        print(f"   Artista : {song.artist}")
        print(f"   Duración: {song.duration_seconds}s")
        print(f"   ID      : {song.video_id}")
        print()

    print("-" * 70)

    index = int(input("Número a descargar: ")) - 1

    selected = results[index]

    print("\nObteniendo información completa...\n")

    info = dl.get_video_info(selected.url)

    if info is None:
        print("No se pudo obtener información del video.")
        return

    print("=" * 70)
    print("VIDEO")
    print("=" * 70)

    print("Título :", info.title)
    print("Autor  :", info.artist)
    print("ID     :", info.video_id)
    print("Duración:", info.duration_seconds)

    print("\nMiniaturas:", len(info.thumbnails))
    print("Formatos :", len(info.formats))

    print("\nFORMATOS DISPONIBLES\n")

    audio_formats = []

    for fmt in info.formats:
        audio_only = getattr(fmt, "is_audio_only", False)

        if audio_only:
            audio_formats.append(fmt)

            print(
                f"{fmt.format_id:>4} | "
                f"{fmt.ext:<5} | "
                f"{fmt.acodec:<12} | "
                f"{fmt.filesize}"
            )

    print()

    fmt = input(
        "Format ID (ENTER = mejor disponible): "
    ).strip()

    output = Path("test_downloads")
    output.mkdir(exist_ok=True)

    print("\nDescargando...\n")

    kwargs = {
        "output_dir": output,
        "progress_callback": progress,
    }

    if fmt:
        kwargs["format_id"] = fmt

    result = dl.download(selected, **kwargs)

    print("\n")
    print("=" * 70)
    print("DESCARGA FINALIZADA")
    print("=" * 70)

    print(result)

    print("\nArchivo descargado:")
    print(result.filepath)


if __name__ == "__main__":
    main()
