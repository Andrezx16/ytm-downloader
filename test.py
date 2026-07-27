from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

# Busca el .env empezando en la carpeta actual y subiendo hasta
# encontrarlo — no importa si test.py y .env estan en la misma
# carpeta o en carpetas distintas.
_dotenv_path = find_dotenv(usecwd=True)
load_dotenv(_dotenv_path)

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logging.info(".env encontrado en: %s", _dotenv_path or "(NO ENCONTRADO)")

from extractor import read_file_info
from matcher import find_matches, merge_missing_fields

from lyrics import get_lyrics
from writer import write_metadata

from providers.deezer import DeezerProvider
from providers.apple import AppleMusicProvider
from providers.musicbrainz import MusicBrainzProvider
from providers.lastfm import LastFmProvider


def print_candidate(provider_name: str, candidate: dict):
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


async def main():
    if len(sys.argv) != 2:
        print("Uso:")
        print("python test_pipeline.py <archivo>")
        return

    path = sys.argv[1]

    print("=" * 80)
    print("LEYENDO ARCHIVO")
    print("=" * 80)

    info = read_file_info(path)

    print(f"Título   : {info.title}")
    print(f"Artista  : {info.artist}")
    print(f"Álbum    : {info.album}")
    print(f"Duración : {info.duration_ms / 1000:.1f}s")
    print()

    providers = [
        DeezerProvider(),
        AppleMusicProvider(),
        MusicBrainzProvider(),
        LastFmProvider(),
    ]

    print("=" * 80)
    print("BUSCANDO COINCIDENCIAS")
    print("=" * 80)

    matches = await find_matches(info, providers)

    if not matches:
        print("No se encontraron coincidencias.")

        for p in providers:
            if hasattr(p, "aclose"):
                await p.aclose()

        return

    print()
    print("=" * 80)
    print("DATOS DEVUELTOS POR CADA PROVIDER")
    print("=" * 80)

    grouped = {}

    for m in matches:
        grouped.setdefault(m["source"], []).append(m)

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

    for i, m in enumerate(matches, 1):
        print(
            f"[{i}] "
            f"{m['source']:12}"
            f"{m['confidence']:.3f}   "
            f"{m['artist']} - {m['title']}"
        )

    print()

    choice = input("Elegir candidato (ENTER = 1): ").strip()

    if choice:
        best = matches[int(choice) - 1]
    else:
        best = matches[0]

    print()

    print("=" * 80)
    print("CANDIDATO ELEGIDO")
    print("=" * 80)

    print_candidate(best["source"], best)

    # Paso 1: completar campos en None usando los demas candidatos
    # que ya se encontraron en la misma busqueda (sin llamadas extra).
    best = merge_missing_fields(best, matches)

    # Paso 2 (fallback puntual): solo Deezer necesita una llamada extra para
    # traer track_number/disc_number/isrc (no vienen en /search).
    # Se hace SOLO sobre el candidato elegido, no sobre los 5 de cada
    # busqueda, para no gastar llamadas de mas.
    still_missing = any(
        best.get(f) is None for f in ("track_number", "disc_number", "isrc", "year")
    )
    # Buscamos un candidato de Deezer entre TODOS los encontrados, no
    # solo si el elegido fue el de Deezer -- si elegiste, por ejemplo,
    # el de Last.fm, igual puede haber un candidato de Deezer en la
    # misma busqueda con su propio source_id que sirve para esto.
    deezer_candidate = next((m for m in matches if m["source"] == "deezer"), None)
    if still_missing and deezer_candidate and deezer_candidate.get("source_id"):
        print("Pidiendo detalle completo a Deezer (siguen faltando campos)...")
        deezer_provider = next(p for p in providers if p.name == "deezer")
        details = await deezer_provider.get_full_details(deezer_candidate["source_id"])
        if details:
            for key, value in details.items():
                if value is not None:
                    best[key] = value
            print("Detalle de Deezer aplicado.")
        else:
            print("No se pudo obtener el detalle de Deezer, se sigue sin esos campos.")

    print("Buscando letras...")

    lyrics = await get_lyrics(
        best["title"],
        best["artist"],
    )

    if lyrics:
        print("✓ Letras encontradas")
    else:
        print("✗ No se encontraron letras")

    metadata = {
        "title": best["title"],
        "artist": best["artist"],
        "album": best["album"],
        "album_artist": best["album_artist"],
        "year": best["year"],
        "genre": best["genre"],
        "track_number": best["track_number"],
        "disc_number": best["disc_number"],
        "isrc": best["isrc"],
        "composer": best["composer"],
        "cover_url": best["cover_url"],
        "lyrics": lyrics,
    }

    print()
    print("=" * 80)
    print("METADATA QUE SE VA A ESCRIBIR")
    print("=" * 80)

    for k, v in metadata.items():
        if k == "lyrics":
            print(f"{k:15}: {'Sí' if v else 'No'}")
        else:
            print(f"{k:15}: {v}")

    print()

    write = input("¿Escribir metadata en el archivo? [Y/n]: ").strip().lower()

    if write in ("", "y", "yes", "s", "si", "sí"):

        print("Escribiendo metadata...")

        await write_metadata(path, metadata)

        print("✓ Metadata escrita correctamente")

    else:
        print("Escritura cancelada.")

    for p in providers:
        if hasattr(p, "aclose"):
            await p.aclose()


if __name__ == "__main__":
    asyncio.run(main())