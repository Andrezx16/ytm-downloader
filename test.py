from __future__ import annotations

"""
Ejemplo:
  python test.py "C:\\Music\\Believer.mp3"
"""

import asyncio
import logging
import sys

from dotenv import find_dotenv, load_dotenv

# Busca el .env empezando en la carpeta actual y subiendo hasta
# encontrarlo — no importa si test.py y .env estan en la misma
# carpeta o en carpetas distintas.
_dotenv_path = find_dotenv(usecwd=True)
load_dotenv(_dotenv_path)

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logging.info(".env encontrado en: %s", _dotenv_path or "(NO ENCONTRADO)")

from pipeline import MetadataPipeline
from providers.base import MatchCandidate


def print_candidate(provider_name: str, candidate: MatchCandidate):
    print("=" * 80)
    print(provider_name.upper())
    print("=" * 80)

    fields = [
        "title",
        "artist",
        "album",
        "album_artist",
        "year",
        "genre",
        "track_number",
        "disc_number",
        "isrc",
        "composer",
        "duration_ms",
        "cover_url",
        "confidence",
    ]

    for field in fields:
        print(f"{field:15}: {candidate.get(field)}")

    print()


async def main() -> int:
    if len(sys.argv) != 2:
        print("Uso:")
        print("python test.py <archivo>")
        return 1

    path = sys.argv[1]

    async with MetadataPipeline() as pipeline:
        print("=" * 80)
        print("LEYENDO ARCHIVO")
        print("=" * 80)

        analysis = await pipeline.analyze_file(path)
        info = analysis.file_info

        print(f"Título   : {info.title}")
        print(f"Artista  : {info.artist}")
        print(f"Álbum    : {info.album}")
        print(f"Duración : {info.duration_ms / 1000:.1f}s")
        print()

        if not analysis.matches:
            print("No se encontraron coincidencias.")
            return 0

        print("=" * 80)
        print("DATOS DEVUELTOS POR CADA PROVIDER")
        print("=" * 80)

        grouped: dict[str, list[MatchCandidate]] = {}
        for match in analysis.matches:
            grouped.setdefault(match["source"], []).append(match)

        for provider, candidates in grouped.items():
            print()
            print("#" * 80)
            print(provider.upper())
            print("#" * 80)

            for i, candidate in enumerate(candidates, 1):
                print(f"CANDIDATO #{i}")
                print_candidate(provider, candidate)

        print("=" * 80)
        print("RANKING FINAL")
        print("=" * 80)

        for i, match in enumerate(analysis.matches, 1):
            print(
                f"[{i}] "
                f"{match['source']:12}"
                f"{match['confidence']:.3f}   "
                f"{match['artist']} - {match['title']}"
            )

        print()

        choice = input("Elegir candidato (ENTER = 1): ").strip()
        selected_index = int(choice) - 1 if choice else 0

        result = await pipeline.enrich_file(
            path,
            selected_index=selected_index,
            analysis=analysis,
            write=False,
        )

        print()
        print("=" * 80)
        print("CANDIDATO ELEGIDO")
        print("=" * 80)
        if result.selected_match is not None:
            print_candidate(result.selected_match["source"], result.selected_match)

        if result.warnings:
            print()
            print("Advertencias:")
            for warning in result.warnings:
                print(f"- {warning}")

        if result.errors:
            print()
            print("Errores:")
            for error in result.errors:
                print(f"- {error}")

        print()
        print("=" * 80)
        print("METADATA QUE SE VA A ESCRIBIR")
        print("=" * 80)

        if result.metadata is not None:
            for key, value in result.metadata.items():
                if key == "lyrics":
                    print(f"{key:15}: {'Sí' if value else 'No'}")
                else:
                    print(f"{key:15}: {value}")

        print()

        write = input("¿Escribir metadata en el archivo? [Y/n]: ").strip().lower()
        if write in ("", "y", "yes", "s", "si", "sí") and result.metadata is not None:
            print("Escribiendo metadata...")
            await pipeline.write_metadata(path, result.metadata)
            print("✓ Metadata escrita correctamente")
        else:
            print("Escritura cancelada.")

        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
