from __future__ import annotations

import copy
import json
import logging
import threading
import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Callable, Iterable, Literal, Sequence

import downloader as single_downloader
from downloader import classify_download_error, friendly_download_error

logger = logging.getLogger(__name__)


PlaylistProgressCallback = Callable[["PlaylistDownloadProgress"], None]
PlaylistStartCallback = Callable[["PlaylistInfo"], None]
SongStartCallback = Callable[["PlaylistDownloadProgress"], None]
SongProgressCallback = Callable[["PlaylistDownloadProgress"], None]
SongFinishCallback = Callable[["PlaylistDownloadProgress"], None]
SongErrorCallback = Callable[["PlaylistDownloadProgress", Exception], None]
PlaylistFinishCallback = Callable[["PlaylistDownloadResult"], None]


def _safe_filename_component(value: str) -> str:
    return "".join("_" if ch in '<>:"/\\|?*' or ord(ch) < 32 else ch for ch in value).strip().strip(".") or "untitled"


def _normalize_indices(indices: int | Iterable[int], total: int) -> tuple[int, ...]:
    if isinstance(indices, int):
        items = [indices]
    else:
        items = list(indices)

    normalized: list[int] = []
    for index in items:
        if not isinstance(index, int):
            raise TypeError("Playlist indices must be integers")
        resolved = (index - 1) if index > 0 else total + index
        if resolved < 0 or resolved >= total:
            raise IndexError(f"Playlist index out of range: {index}")
        if resolved not in normalized:
            normalized.append(resolved)
    return tuple(normalized)


@dataclass(slots=True)
class PlaylistEntry:
    title: str
    artist: str | None = None
    album: str | None = None
    duration_seconds: int | None = None
    video_id: str | None = None
    url: str | None = None
    thumbnail_url: str | None = None
    uploader: str | None = None
    position: int | None = None
    provider: Literal["youtube"] = "youtube"

    @classmethod
    def from_downloader_entry(
        cls,
        entry: single_downloader.PlaylistEntry,
        *,
        position: int | None = None,
    ) -> "PlaylistEntry":
        return cls(
            title=entry.title,
            artist=entry.artist,
            album=entry.album,
            duration_seconds=entry.duration_seconds,
            video_id=entry.video_id,
            url=entry.url,
            thumbnail_url=entry.thumbnail_url,
            uploader=entry.uploader,
            position=entry.playlist_index or position,
        )


@dataclass(slots=True)
class PlaylistInfo:
    title: str
    album: str | None
    description: str | None
    uploader: str | None
    thumbnail_url: str | None
    playlist_id: str | None
    entries: tuple[PlaylistEntry, ...]
    _selected_indices: set[int] = field(default_factory=set, init=False, repr=False, compare=False)

    @classmethod
    def from_downloader_info(cls, info: single_downloader.PlaylistInfo) -> "PlaylistInfo":
        entries = tuple(
            PlaylistEntry.from_downloader_entry(entry, position=index)
            for index, entry in enumerate(info.entries, start=1)
        )
        playlist = cls(
            title=info.title,
            album=info.album,
            description=info.description,
            uploader=info.author,
            thumbnail_url=info.thumbnail_url,
            playlist_id=info.playlist_id,
            entries=entries,
        )
        return playlist

    @property
    def total_tracks(self) -> int:
        return len(self.entries)

    @property
    def total_duration(self) -> int:
        return sum(entry.duration_seconds or 0 for entry in self.entries)

    @property
    def selected_entries(self) -> tuple[PlaylistEntry, ...]:
        return tuple(self.entries[index] for index in self.selected_indices)

    @property
    def selected_indices(self) -> tuple[int, ...]:
        return tuple(sorted(self._selected_indices))

    @property
    def selected_count(self) -> int:
        return len(self._selected_indices)

    @property
    def selected_duration(self) -> int:
        return sum(self.entries[index].duration_seconds or 0 for index in self._selected_indices)

    @property
    def has_selection(self) -> bool:
        return bool(self._selected_indices)

    @property
    def is_empty(self) -> bool:
        return not self.entries

    def get_entry(self, index: int) -> PlaylistEntry:
        return self.entries[index]

    def select(self, indices: int | Iterable[int]) -> None:
        self._selected_indices.update(_normalize_indices(indices, len(self.entries)))

    def unselect(self, indices: int | Iterable[int]) -> None:
        for index in _normalize_indices(indices, len(self.entries)):
            self._selected_indices.discard(index)

    def toggle(self, index: int) -> None:
        resolved = _normalize_indices(index, len(self.entries))[0]
        if resolved in self._selected_indices:
            self._selected_indices.remove(resolved)
        else:
            self._selected_indices.add(resolved)

    def select_all(self) -> None:
        self._selected_indices = set(range(len(self.entries)))

    def unselect_all(self) -> None:
        self._selected_indices.clear()

    def clear_selection(self) -> None:
        self.unselect_all()

    def summary(self) -> str:
        duration = _format_duration(self.total_duration)
        selected = f", selected={self.selected_count}" if self.has_selection else ""
        playlist_id = f", id={self.playlist_id}" if self.playlist_id else ""
        uploader = f", uploader={self.uploader}" if self.uploader else ""
        return f"Playlist: {self.title}{playlist_id}{uploader}, tracks={self.total_tracks}{selected}, duration={duration}"

    def print_summary(self) -> str:
        text = self.summary()
        logger.info(text)
        return text

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "album": self.album,
            "description": self.description,
            "uploader": self.uploader,
            "thumbnail_url": self.thumbnail_url,
            "playlist_id": self.playlist_id,
            "total_tracks": self.total_tracks,
            "total_duration": self.total_duration,
            "selected_indices": list(self.selected_indices),
            "selected_count": self.selected_count,
            "selected_duration": self.selected_duration,
            "has_selection": self.has_selection,
            "is_empty": self.is_empty,
            "entries": [
                {
                    "title": entry.title,
                    "artist": entry.artist,
                    "album": entry.album,
                    "duration_seconds": entry.duration_seconds,
                    "video_id": entry.video_id,
                    "url": entry.url,
                    "thumbnail_url": entry.thumbnail_url,
                    "uploader": entry.uploader,
                    "position": entry.position,
                    "provider": entry.provider,
                }
                for entry in self.entries
            ],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    def __len__(self) -> int:
        return len(self.entries)

    def __getitem__(self, index: int | slice) -> PlaylistEntry | tuple[PlaylistEntry, ...]:
        return self.entries[index]

    def __iter__(self):
        return iter(self.entries)


@dataclass(slots=True)
class PlaylistDownloadOptions:
    output_directory: str | Path = "."
    format_id: str | None = None
    audio_options: single_downloader.AudioDownloadOptions | None = None
    retries: int = 2
    overwrite: bool = False
    skip_existing: bool = False
    embed_thumbnail: bool = True
    embed_metadata: bool = True
    progress_callback: PlaylistProgressCallback | None = None
    on_playlist_start: PlaylistStartCallback | None = None
    on_song_start: SongStartCallback | None = None
    on_song_progress: SongProgressCallback | None = None
    on_song_finish: SongFinishCallback | None = None
    on_song_error: SongErrorCallback | None = None
    on_playlist_finish: PlaylistFinishCallback | None = None


@dataclass(slots=True)
class PlaylistDownloadProgress:
    playlist_title: str
    playlist_id: str | None
    total_tracks: int
    selected_tracks: int
    completed_tracks: int
    successful: int
    failed: int
    skipped: int
    cancelled: bool
    current_index: int | None = None
    current_entry: PlaylistEntry | None = None
    current_song_progress: single_downloader.DownloadProgress | None = None
    message: str | None = None
    filepath: str | None = None


@dataclass(slots=True)
class PlaylistDownloadResult:
    successful: int
    failed: int
    skipped: int
    cancelled: bool
    elapsed_time: float
    downloaded_bytes: int
    average_speed: float | None
    output_directory: str
    total_bytes: int = 0
    downloaded_files: list[str] = field(default_factory=list)
    failed_files: list[str] = field(default_factory=list)
    skipped_files: list[str] = field(default_factory=list)


class PlaylistDownloader:
    def __init__(self, downloader: single_downloader.YoutubeDownloader | None = None) -> None:
        self._downloader = downloader or single_downloader.YoutubeDownloader()
        self._playlist_cache: dict[str, PlaylistInfo] = {}
        self._cancel_requested = threading.Event()

    def get_playlist(self, url: str) -> PlaylistInfo:
        cached = self._playlist_cache.get(url)
        if cached is not None:
            return cached

        info = self._downloader.get_playlist_info(url)
        if info is None:
            raise RuntimeError(f"Unable to extract playlist metadata for {url!r}")

        playlist = PlaylistInfo.from_downloader_info(info)
        self._cache_playlist(url, playlist)
        return playlist

    def download(
        self,
        playlist: PlaylistInfo | str,
        selected: Sequence[int] | None = None,
        options: PlaylistDownloadOptions | None = None,
    ) -> PlaylistDownloadResult:
        opts = options or PlaylistDownloadOptions()
        resolved_playlist = self._resolve_playlist(playlist)
        work_playlist = self._clone_playlist(resolved_playlist)

        if selected is not None:
            work_playlist.clear_selection()
            work_playlist.select(selected)
        elif not work_playlist.has_selection:
            work_playlist.select_all()

        output_directory = Path(opts.output_directory)
        output_directory.mkdir(parents=True, exist_ok=True)

        audio_options = self._merge_audio_options(opts.audio_options, opts.embed_thumbnail, opts.embed_metadata)

        self._cancel_requested.clear()
        start = time.perf_counter()
        successful = 0
        failed = 0
        skipped = 0
        downloaded_bytes = 0
        downloaded_files: list[str] = []
        failed_files: list[str] = []
        skipped_files: list[str] = []

        self._safe_callback(opts.on_playlist_start, work_playlist)

        selected_entries = work_playlist.selected_entries
        total_selected = len(selected_entries)
        if total_selected == 0:
            result = PlaylistDownloadResult(
                successful=0,
                failed=0,
                skipped=0,
                cancelled=False,
                elapsed_time=0.0,
                downloaded_bytes=0,
                average_speed=None,
                output_directory=str(output_directory),
                total_bytes=0,
                downloaded_files=[],
                failed_files=[],
                skipped_files=[],
            )
            self._safe_callback(opts.on_playlist_finish, result)
            return result

        for position, entry in enumerate(selected_entries, start=1):
            if self._cancel_requested.is_set():
                break

            if opts.skip_existing and not opts.overwrite and self._entry_exists(entry, output_directory):
                skipped += 1
                skipped_files.append(self._entry_output_path(entry, output_directory))
                progress = self._make_progress(
                    playlist=work_playlist,
                    completed_tracks=successful + failed + skipped,
                    successful=successful,
                    failed=failed,
                    skipped=skipped,
                    cancelled=False,
                    current_index=entry.position,
                    current_entry=entry,
                    current_song_progress=None,
                    message=f"Skipped existing file for {entry.title}",
                )
                self._safe_callback(opts.progress_callback, progress)
                continue

            progress = self._make_progress(
                playlist=work_playlist,
                completed_tracks=successful + failed + skipped,
                successful=successful,
                failed=failed,
                skipped=skipped,
                cancelled=False,
                current_index=entry.position,
                current_entry=entry,
                current_song_progress=None,
                message=f"Starting {entry.title}",
            )
            self._safe_callback(opts.on_song_start, progress)
            self._safe_callback(opts.progress_callback, progress)

            last_progress: PlaylistDownloadProgress | None = None
            last_error: Exception | None = None
            max_attempts = max(0, opts.retries) + 1
            for attempt in range(max_attempts):
                if self._cancel_requested.is_set():
                    break

                def song_progress_callback(song_progress: single_downloader.DownloadProgress) -> None:
                    nonlocal last_progress
                    last_progress = self._make_progress(
                        playlist=work_playlist,
                        completed_tracks=successful + failed + skipped,
                        successful=successful,
                        failed=failed,
                        skipped=skipped,
                        cancelled=False,
                        current_index=entry.position,
                        current_entry=entry,
                        current_song_progress=song_progress,
                        message=f"Downloading {entry.title}",
                    )
                    self._safe_callback(opts.on_song_progress, last_progress)
                    self._safe_callback(opts.progress_callback, last_progress)

                try:
                    song_result = self._downloader.download(
                        self._entry_video_info(entry),
                        output_dir=output_directory,
                        format_id=opts.format_id,
                        audio_options=audio_options,
                        progress_callback=song_progress_callback,
                    )
                    downloaded_files.append(song_result.filepath)
                    file_size = self._file_size(song_result.filepath)
                    downloaded_bytes += file_size
                    successful += 1
                    last_progress = self._make_progress(
                        playlist=work_playlist,
                        completed_tracks=successful + failed + skipped,
                        successful=successful,
                        failed=failed,
                        skipped=skipped,
                        cancelled=False,
                        current_index=entry.position,
                        current_entry=entry,
                        current_song_progress=last_progress.current_song_progress if last_progress else None,
                        message=f"Finished {entry.title}",
                        filepath=song_result.filepath,
                    )
                    self._safe_callback(opts.on_song_finish, last_progress)
                    self._safe_callback(opts.progress_callback, last_progress)
                    break
                except Exception as exc:  # pragma: no cover - retry path is exercised manually
                    last_error = exc
                    classification = classify_download_error(exc)
                    friendly_msg = friendly_download_error(exc)
                    is_last_attempt = attempt >= max_attempts - 1

                    logger.warning(
                        "Playlist item failed (%s/%s) for %r: classification=%s error=%s",
                        attempt + 1,
                        max_attempts,
                        entry.title,
                        classification,
                        exc,
                    )

                    if classification == "permanent" or is_last_attempt:
                        if classification == "permanent":
                            logger.warning(
                                "Permanent error detected for %r, skipping retries",
                                entry.title,
                            )
                        failed += 1
                        failed_files.append(self._entry_output_path(entry, output_directory))
                        failure_progress = self._make_progress(
                            playlist=work_playlist,
                            completed_tracks=successful + failed + skipped,
                            successful=successful,
                            failed=failed,
                            skipped=skipped,
                            cancelled=False,
                            current_index=entry.position,
                            current_entry=entry,
                            current_song_progress=last_progress.current_song_progress if last_progress else None,
                            message=f"Failed {entry.title}: {friendly_msg}",
                        )
                        self._safe_callback(opts.on_song_error, failure_progress, exc)
                        self._safe_callback(opts.progress_callback, failure_progress)
                        break
                    else:
                        logger.info(
                            "Retrying %r (attempt %s/%s)",
                            entry.title,
                            attempt + 2,
                            max_attempts,
                        )
                        continue

        cancelled = self._cancel_requested.is_set()
        elapsed_time = time.perf_counter() - start
        average_speed = (downloaded_bytes / elapsed_time) if elapsed_time > 0 and downloaded_bytes else None
        result = PlaylistDownloadResult(
            successful=successful,
            failed=failed,
            skipped=skipped,
            cancelled=cancelled,
            elapsed_time=elapsed_time,
            downloaded_bytes=downloaded_bytes,
            average_speed=average_speed,
            output_directory=str(output_directory),
            total_bytes=downloaded_bytes,
            downloaded_files=downloaded_files,
            failed_files=failed_files,
            skipped_files=skipped_files,
        )
        final_progress = self._make_progress(
            playlist=work_playlist,
            completed_tracks=successful + failed + skipped,
            successful=successful,
            failed=failed,
            skipped=skipped,
            cancelled=cancelled,
            current_index=None,
            current_entry=None,
            current_song_progress=None,
            message="Playlist finished" if not cancelled else "Playlist cancelled",
        )
        self._safe_callback(opts.progress_callback, final_progress)
        self._safe_callback(opts.on_playlist_finish, result)
        return result

    def _merge_audio_options(
        self,
        audio_options: single_downloader.AudioDownloadOptions | None,
        embed_thumbnail: bool,
        embed_metadata: bool,
    ) -> single_downloader.AudioDownloadOptions:
        base = audio_options or single_downloader.AudioDownloadOptions()
        return replace(
            base,
            embed_thumbnail=embed_thumbnail if embed_thumbnail is not None else base.embed_thumbnail,
            embed_metadata=embed_metadata if embed_metadata is not None else base.embed_metadata,
        )

    def cancel(self) -> None:
        self._cancel_requested.set()

    def _resolve_playlist(self, playlist: PlaylistInfo | str) -> PlaylistInfo:
        if isinstance(playlist, PlaylistInfo):
            return playlist
        return self.get_playlist(playlist)

    def _clone_playlist(self, playlist: PlaylistInfo) -> PlaylistInfo:
        cloned = PlaylistInfo(
            title=playlist.title,
            album=playlist.album,
            description=playlist.description,
            uploader=playlist.uploader,
            thumbnail_url=playlist.thumbnail_url,
            playlist_id=playlist.playlist_id,
            entries=tuple(copy.deepcopy(entry) for entry in playlist.entries),
        )
        cloned._selected_indices = set(playlist._selected_indices)
        return cloned

    def _cache_playlist(self, key: str, playlist: PlaylistInfo) -> None:
        self._playlist_cache[key] = playlist
        if playlist.playlist_id:
            self._playlist_cache.setdefault(playlist.playlist_id, playlist)

    def _entry_exists(self, entry: PlaylistEntry, output_directory: Path) -> bool:
        return output_directory.joinpath(Path(self._entry_output_path(entry, output_directory)).name).exists()

    def _entry_output_path(self, entry: PlaylistEntry, output_directory: Path) -> str:
        base = _safe_filename_component(f"{entry.title} [{entry.video_id or 'unknown'}]")
        existing = sorted(output_directory.glob(f"{base}.*"))
        if existing:
            return str(existing[0])
        return str(output_directory / f"{base}.unknown")

    def _entry_target(self, entry: PlaylistEntry) -> str:
        if entry.url:
            return entry.url
        if entry.video_id:
            return f"https://www.youtube.com/watch?v={entry.video_id}"
        raise ValueError(f"Playlist entry {entry.title!r} cannot be downloaded without a url or video_id")

    def _entry_video_info(self, entry: PlaylistEntry) -> single_downloader.VideoInfo:
        url = entry.url or (f"https://www.youtube.com/watch?v={entry.video_id}" if entry.video_id else None)
        return single_downloader.VideoInfo(
            video_id=entry.video_id,
            title=entry.title,
            artist=entry.artist,
            album=entry.album,
            url=url,
            thumbnail_url=entry.thumbnail_url,
            duration_seconds=entry.duration_seconds,
            uploader=entry.uploader,
            channel=entry.uploader,
        )

    def _file_size(self, filepath: str) -> int:
        try:
            return Path(filepath).stat().st_size
        except OSError:
            return 0

    def _make_progress(
        self,
        *,
        playlist: PlaylistInfo,
        completed_tracks: int,
        successful: int,
        failed: int,
        skipped: int,
        cancelled: bool,
        current_index: int | None,
        current_entry: PlaylistEntry | None,
        current_song_progress: single_downloader.DownloadProgress | None,
        message: str | None,
        filepath: str | None = None,
    ) -> PlaylistDownloadProgress:
        return PlaylistDownloadProgress(
            playlist_title=playlist.title,
            playlist_id=playlist.playlist_id,
            total_tracks=playlist.total_tracks,
            selected_tracks=playlist.selected_count,
            completed_tracks=completed_tracks,
            successful=successful,
            failed=failed,
            skipped=skipped,
            cancelled=cancelled,
            current_index=current_index,
            current_entry=current_entry,
            current_song_progress=current_song_progress,
            message=message,
            filepath=filepath,
        )

    def _safe_callback(self, callback: Callable[..., Any] | None, *args: Any) -> None:
        if callback is None:
            return
        try:
            callback(*args)
        except Exception:  # pragma: no cover - defensive logging only
            logger.exception("Playlist callback failed")


def _format_duration(total_seconds: int) -> str:
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:d}:{seconds:02d}"


__all__ = [
    "PlaylistDownloadOptions",
    "PlaylistDownloadProgress",
    "PlaylistDownloadResult",
    "PlaylistDownloader",
    "PlaylistEntry",
    "PlaylistInfo",
]
