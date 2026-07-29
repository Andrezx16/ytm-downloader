from __future__ import annotations

"""
Ejemplo:
  python test_playlist.py "https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-" --summary
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import logging
import threading
import time

from playlist_downloader import (
    PlaylistDownloadOptions,
    PlaylistDownloader,
    PlaylistDownloadProgress,
)
from downloader import AudioDownloadOptions


def _parse_indices(value: str) -> list[int]:
    if not value.strip():
        return []
    return [int(item.strip()) for item in value.split(",") if item.strip()]


def _format_song_progress(progress: PlaylistDownloadProgress, *, verbose: bool = False) -> str:
    current = progress.current_entry.title if progress.current_entry else "-"
    song = progress.current_song_progress
    if song is None:
        return f"Playlist {progress.completed_tracks + 1}/{progress.selected_tracks} | {current}"
    percent = f"{song.percent:.0f}%" if song.percent is not None else song.status
    if not verbose:
        return f"Playlist {progress.completed_tracks + 1}/{progress.selected_tracks} | {current} | {percent}"

    parts = [f"Playlist {progress.completed_tracks + 1}/{progress.selected_tracks}", current, percent]
    if song.speed_bytes_per_second is not None:
        parts.append(f"{song.speed_bytes_per_second / (1024 * 1024):.2f} MB/s")
    if song.eta_seconds is not None:
        parts.append(f"ETA {_format_elapsed(song.eta_seconds)}")
    return " | ".join(parts)


def _format_elapsed(seconds: float) -> str:
    total = max(0, int(seconds))
    minutes, secs = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def _print_progress_line(line: str, *, width: int, end: str = "") -> None:
    padded = line.ljust(width)
    sys.stdout.write(f"\r{padded}{end}")
    sys.stdout.flush()


def _print_summary(result, *, width: int = 40) -> None:
    print()
    print("=" * width)
    print("Playlist completed")
    print()
    print(f"Downloaded : {result.successful}")
    print(f"Failed     : {result.failed}")
    print(f"Skipped    : {result.skipped}")
    print(f"Elapsed    : {_format_elapsed(result.elapsed_time)}")
    print(f"Bytes      : {result.total_bytes}")
    if result.average_speed is not None:
        print(f"Speed      : {result.average_speed / (1024 * 1024):.2f} MB/s")
    print("Output     :")
    print(result.output_directory)
    if result.downloaded_files:
        print()
        print("Downloaded files:")
        for path in result.downloaded_files:
            print(path)
    print("=" * width)


def main() -> int:
    parser = argparse.ArgumentParser(description="Playlist downloader debug CLI")
    parser.add_argument("url", help="Playlist URL")
    parser.add_argument("--summary", action="store_true", help="Print playlist summary")
    parser.add_argument("--select", type=_parse_indices, default=None, help="Comma-separated 0-based indices")
    parser.add_argument("--download", action="store_true", help="Download selected songs")
    parser.add_argument("--download-all", action="store_true", help="Download the entire playlist")
    parser.add_argument("--output-dir", default="test_downloads", help="Download directory")
    parser.add_argument("--format-id", default=None, help="yt-dlp format id")
    parser.add_argument("--quality", choices=["best", "high", "medium", "low"], default="best", help="Audio quality preset")
    parser.add_argument("--container", choices=["auto", "m4a", "opus", "original"], default="auto", help="Audio container preference")
    parser.add_argument("--no-embed-thumbnail", action="store_true", help="Disable thumbnail intent flag")
    parser.add_argument("--no-embed-metadata", action="store_true", help="Disable metadata intent flag")
    parser.add_argument("--no-download-lyrics", action="store_true", help="Disable lyrics intent flag")
    parser.add_argument("--retries", type=int, default=2, help="Retries per song")
    parser.add_argument("--skip-existing", action="store_true", help="Skip files already present")
    parser.add_argument("--overwrite", action="store_true", help="Force downloads even if files exist")
    parser.add_argument("--cancel-after", type=float, default=None, help="Cancel after N seconds")
    parser.add_argument("--verbose", action="store_true", help="Print per-song progress details")
    parser.add_argument("--log-level", default="INFO", help="Logging level")
    args = parser.parse_args()

    logging.basicConfig(level=getattr(logging, args.log_level.upper(), logging.INFO), format="%(levelname)s: %(message)s")

    downloader = PlaylistDownloader()
    playlist = downloader.get_playlist(args.url)

    if args.summary or not args.download:
        print(playlist.summary())
        for index, entry in enumerate(playlist.entries):
            print(f"{index}: {entry.title} [{entry.video_id or '-'}]")

    if args.select is not None:
        playlist.clear_selection()
        playlist.select(args.select)
        print(f"Selected indices: {playlist.selected_indices}")

    if not args.download and not args.download_all:
        return 0

    selected = None if args.download_all else args.select
    terminal_width = 80
    last_rendered = ""

    def on_progress(progress: PlaylistDownloadProgress) -> None:
        nonlocal last_rendered

        if progress.current_song_progress is None and progress.message:
            if progress.message.startswith("Finished"):
                sys.stdout.write("\r" + " " * len(last_rendered) + "\r")
                print(f"✓ {progress.current_entry.title if progress.current_entry else progress.message}")
                last_rendered = ""
                return
            if progress.message.startswith("Skipped"):
                sys.stdout.write("\r" + " " * len(last_rendered) + "\r")
                print(f"↷ {progress.current_entry.title if progress.current_entry else progress.message}")
                last_rendered = ""
                return
            if progress.message.startswith("Failed"):
                sys.stdout.write("\r" + " " * len(last_rendered) + "\r")
                print(f"✗ {progress.current_entry.title if progress.current_entry else progress.message}")
                last_rendered = ""
                return

        line = _format_song_progress(progress, verbose=args.verbose)
        last_rendered = line
        _print_progress_line(line, width=terminal_width)

    options = PlaylistDownloadOptions(
        output_directory=Path(args.output_dir),
        format_id=args.format_id,
        audio_options=AudioDownloadOptions(
            quality=args.quality,
            container=args.container,
            embed_thumbnail=not args.no_embed_thumbnail,
            embed_metadata=not args.no_embed_metadata,
            download_lyrics=not args.no_download_lyrics,
        ),
        retries=args.retries,
        overwrite=args.overwrite,
        skip_existing=args.skip_existing,
        progress_callback=on_progress,
    )

    result_holder: dict[str, object] = {}

    def run_download() -> None:
        try:
            result_holder["result"] = downloader.download(playlist, selected=selected, options=options)
        except Exception as exc:  # pragma: no cover - CLI debugging only
            result_holder["error"] = exc

    worker = threading.Thread(target=run_download, daemon=True)
    worker.start()

    if args.cancel_after is not None:
        time.sleep(max(0.0, args.cancel_after))
        downloader.cancel()

    worker.join()

    if "error" in result_holder:
        raise result_holder["error"]  # type: ignore[misc]

    result = result_holder.get("result")
    if result is None:
        return 1

    if last_rendered:
        sys.stdout.write("\r" + " " * len(last_rendered) + "\r")
        sys.stdout.flush()

    _print_summary(result)

    if args.verbose:
        print()
        print("Result:")
        print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
