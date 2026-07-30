"""Phase 1 downloader module.

This module only discovers metadata through yt-dlp. It does not download
anything yet. The public API is intentionally shaped so phase 2 can reuse
the same normalized models for actual downloads.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Literal, Mapping, cast
from urllib.parse import parse_qs, urlparse

import yt_dlp
from ytmusicapi import YTMusic

logger = logging.getLogger(__name__)


class _MetadataInjectorPP(yt_dlp.postprocessor.common.PostProcessor):
    """Injects matched metadata into yt-dlp's info_dict before FFmpegMetadataPP runs."""

    def __init__(self, downloader: Any, metadata: dict[str, Any]) -> None:
        super().__init__(downloader)
        self._metadata = metadata

    def run(self, info: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
        for key, value in self._metadata.items():
            if value is not None:
                info[key] = value
        return [], info


@dataclass(slots=True, frozen=True)
class ThumbnailInfo:
    url: str
    width: int | None = None
    height: int | None = None


@dataclass(slots=True, frozen=True)
class FormatInfo:
    format_id: str
    ext: str | None = None
    format_note: str | None = None
    resolution: str | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    tbr: float | None = None
    filesize: int | None = None
    audio_ext: str | None = None
    video_ext: str | None = None
    vcodec: str | None = None
    acodec: str | None = None
    protocol: str | None = None
    url: str | None = None
    is_audio_only: bool = False
    is_video_only: bool = False


@dataclass(slots=True, frozen=True)
class AudioDownloadOptions:
    quality: Literal["best", "high", "medium", "low"] = "best"
    container: Literal["auto", "m4a", "opus", "original"] = "auto"
    embed_thumbnail: bool = True
    embed_metadata: bool = True
    download_lyrics: bool = True


@dataclass(slots=True, frozen=True)
class DownloaderAuth:
    """Authentication configuration for yt-dlp downloads.

    cookies_file:
        Path to an imported cookies.txt file (Netscape format).
        When set, yt-dlp uses --cookiefile to authenticate.
        When None, downloads run anonymously.
    """

    cookies_file: str | None = None


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------

_PERMANENT_PATTERNS: tuple[str, ...] = (
    "sign in to confirm",
    "sign in to verify",
    "cookies required",
    "cookie",
    "captcha",
    "login required",
    "login or",
    "video unavailable",
    "private video",
    "this video is private",
    "deleted video",
    "video has been removed",
    "geo restricted",
    "not available in your country",
    "not available in your region",
    "blocked in your country",
    "content not available",
    "this video is not available",
    "video is unavailable",
    "status blocked",
    "private channel",
    "this channel is private",
    "http error 401",
    "http error 403",
    "http 401",
    "http 403",
    "401 unauthorized",
    "403 forbidden",
    "forbidden",
)

_RETRYABLE_PATTERNS: tuple[str, ...] = (
    "timeout",
    "timed out",
    "connection reset",
    "connection refused",
    "connection aborted",
    "connection broken",
    "network is unreachable",
    "no route to host",
    "name or service not known",
    "temporary",
    "try again",
    "http error 500",
    "http error 502",
    "http error 503",
    "http error 504",
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "500 internal",
    "502 bad",
    "503 service",
    "504 gateway",
    "server error",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENETUNREACH",
)

# Maps substrings in yt-dlp errors to user-friendly messages.
_FRIENDLY_MESSAGE_MAP: tuple[tuple[str, str], ...] = (
    ("sign in to confirm", "Your cookies are no longer valid. Please import a new cookies.txt."),
    ("sign in to verify", "Your cookies are no longer valid. Please import a new cookies.txt."),
    ("cookies required", "Your cookies are no longer valid. Please import a new cookies.txt."),
    ("captcha", "YouTube presented a captcha. Try again later or import a new cookies.txt."),
    ("login required", "Your cookies are no longer valid. Please import a new cookies.txt."),
    ("private video", "This video is private."),
    ("this video is private", "This video is private."),
    ("deleted video", "This video has been deleted."),
    ("video has been removed", "This video has been removed."),
    ("video unavailable", "This video is unavailable."),
    ("this video is not available", "This video is not available."),
    ("video is unavailable", "This video is unavailable."),
    ("geo restricted", "This video is not available in your region."),
    ("not available in your country", "This video is not available in your region."),
    ("not available in your region", "This video is not available in your region."),
    ("blocked in your country", "This video is blocked in your region."),
    ("content not available", "This content is not available."),
    ("http 401", "Authentication required (HTTP 401). Import cookies.txt in Settings."),
    ("http 403", "Access denied (HTTP 403). Import cookies.txt in Settings."),
    ("401 unauthorized", "Authentication required (HTTP 401)."),
    ("403 forbidden", "Access denied (HTTP 403). Import cookies.txt in Settings."),
    ("timeout", "Connection timed out. The network may be slow."),
    ("timed out", "Connection timed out. The network may be slow."),
    ("connection reset", "Connection was reset. The network may be unstable."),
    ("connection refused", "Connection refused. The server may be unavailable."),
    ("network is unreachable", "Network is unreachable. Check your connection."),
    ("http 500", "YouTube server error (HTTP 500). Try again later."),
    ("http 502", "YouTube server error (HTTP 502). Try again later."),
    ("http 503", "YouTube server error (HTTP 503). Try again later."),
    ("http 504", "YouTube server error (HTTP 504). Try again later."),
)


def classify_download_error(error: Exception) -> Literal["retryable", "permanent", "unknown"]:
    """Classify a download error as retryable, permanent, or unknown.

    Unknown errors are treated as permanent to avoid infinite retries.
    """
    msg = str(error).lower()

    for pattern in _PERMANENT_PATTERNS:
        if pattern in msg:
            return "permanent"

    for pattern in _RETRYABLE_PATTERNS:
        if pattern in msg:
            return "retryable"

    return "unknown"


def friendly_download_error(error: Exception) -> str:
    """Return a user-friendly error message for common download failures.

    Falls back to the original error message if no friendly mapping exists.
    """
    msg = str(error).lower()

    for pattern, friendly in _FRIENDLY_MESSAGE_MAP:
        if pattern in msg:
            return friendly

    return str(error)


@dataclass(slots=True, frozen=True)
class SearchResult:
    video_id: str | None
    title: str
    artist: str | None
    url: str | None
    thumbnail_url: str | None
    duration_seconds: int | None
    album: str | None = None
    uploader: str | None = None
    channel: str | None = None
    search_position: int | None = None
    source: Literal["ytmusic", "youtube"] = "youtube"

    @classmethod
    def from_ydl(cls, data: Mapping[str, Any], search_position: int | None = None) -> "SearchResult":
        return _search_result_from_ydl(data, search_position=search_position)


@dataclass(slots=True, frozen=True)
class VideoInfo:
    video_id: str | None
    title: str
    artist: str | None
    url: str | None
    thumbnail_url: str | None
    duration_seconds: int | None
    album: str | None = None
    uploader: str | None = None
    channel: str | None = None
    description: str | None = None
    upload_date: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    availability: str | None = None
    extractor_key: str | None = None
    is_live: bool = False
    tags: tuple[str, ...] = ()
    thumbnails: tuple[ThumbnailInfo, ...] = ()
    formats: tuple[FormatInfo, ...] = ()
    playlist_id: str | None = None
    playlist_title: str | None = None
    playlist_index: int | None = None

    @classmethod
    def from_ydl(cls, data: Mapping[str, Any]) -> "VideoInfo":
        return _video_info_from_ydl(data)


@dataclass(slots=True, frozen=True)
class PlaylistEntry:
    video_id: str | None
    title: str
    artist: str | None
    url: str | None
    thumbnail_url: str | None
    duration_seconds: int | None
    album: str | None = None
    uploader: str | None = None
    channel: str | None = None
    playlist_index: int | None = None

    @classmethod
    def from_ydl(cls, data: Mapping[str, Any]) -> "PlaylistEntry":
        return _playlist_entry_from_ydl(data)


@dataclass(slots=True, frozen=True)
class PlaylistInfo:
    playlist_id: str | None
    title: str
    url: str | None
    author: str | None
    item_count: int
    entries: tuple[PlaylistEntry, ...]
    album: str | None = None
    thumbnail_url: str | None = None
    description: str | None = None

    @classmethod
    def from_ydl(cls, data: Mapping[str, Any]) -> "PlaylistInfo":
        return _playlist_info_from_ydl(data)


@dataclass(slots=True, frozen=True)
class DownloadProgress:
    status: str
    downloaded_bytes: int | None = None
    total_bytes: int | None = None
    percent: float | None = None
    eta_seconds: int | None = None
    speed_bytes_per_second: float | None = None
    filename: str | None = None
    video_id: str | None = None
    title: str | None = None


@dataclass(slots=True, frozen=True)
class DownloadResult:
    video: VideoInfo
    filepath: str
    requested_format_id: str | None
    selected_format: FormatInfo | None
    title: str
    video_id: str | None


ProgressCallback = Callable[[DownloadProgress], None]


class YoutubeMetadataDiscovery:
    """Discovery-only yt-dlp wrapper.

    Public methods never download media. They only return normalized models
    that phase 2 can reuse later for actual downloads.
    """

    def __init__(
        self,
        *,
        auth: DownloaderAuth | None = None,
        ytdlp_options: Mapping[str, Any] | None = None,
        cookies_path: str | None = None,
    ) -> None:
        self._auth = auth or DownloaderAuth()
        self._base_options: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "ignoreerrors": True,
        }

        # Apply cookies.txt authentication if available
        cookie_file = self._auth.cookies_file or cookies_path
        if cookie_file:
            self._base_options["cookiefile"] = cookie_file
            logger.info("Auth mode: cookies.txt (%s)", cookie_file)
        else:
            logger.info("Auth mode: Anonymous")

        if ytdlp_options:
            self._base_options.update(dict(ytdlp_options))

    def search(
        self,
        query: str,
        limit: int = 5,
        filter: Literal["songs", "videos", "all"] = "songs",
    ) -> list[SearchResult]:
        """Search YouTube Music / YouTube by free-text query without downloading anything."""
        query = query.strip()
        if not query:
            return []

        limit = max(1, limit)
        filter = filter if filter in {"songs", "videos", "all"} else "songs"

        if filter == "videos":
            return self._search_youtube(query, limit)

        songs = self._search_ytmusic_songs(query, limit)
        if filter == "songs":
            return songs or self._search_youtube(query, limit)

        youtube = self._search_youtube(query, limit)
        results: list[SearchResult] = []
        seen_video_ids: set[str] = set()

        for item in songs + youtube:
            if item.video_id and item.video_id in seen_video_ids:
                continue
            if item.video_id:
                seen_video_ids.add(item.video_id)
            results.append(item)

        return results[:limit]

    def get_video_info(self, url: str) -> VideoInfo | None:
        """Get normalized metadata for a single video without downloading."""
        raw = self._extract_info(url, {"noplaylist": True})
        if not raw or raw.get("_type") == "playlist":
            return None
        return VideoInfo.from_ydl(raw)

    def get_playlist_info(self, url: str) -> PlaylistInfo | None:
        """Inspect a playlist and normalize its entries without downloading."""
        raw = self._extract_info(url, {"extract_flat": True})
        if not raw:
            return None
        return PlaylistInfo.from_ydl(raw)

    def download(
        self,
        video: VideoInfo | SearchResult | str,
        *,
        output_dir: str | Path = ".",
        format_id: str | None = None,
        audio_options: AudioDownloadOptions | None = None,
        format_selector: str | None = None,
        filename_template: str = "{title} [{video_id}]",
        progress_callback: ProgressCallback | None = None,
    ) -> DownloadResult:
        """Download a single video with yt-dlp.

        Phase 2 reuses the normalized phase 1 metadata. The caller may pass a
        `VideoInfo` instance directly, or a URL / video id that will be resolved
        through the discovery API.
        """
        resolved_video = self._coerce_video_info(video)
        effective_audio_options = audio_options or AudioDownloadOptions()
        selected_format = self._select_format(resolved_video, format_id, effective_audio_options)

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        safe_title = _safe_filename_component(resolved_video.title)
        safe_video_id = _safe_filename_component(resolved_video.video_id or "unknown")
        filename_base = filename_template.format(title=safe_title, video_id=safe_video_id)
        filename_base = _safe_filename_component(filename_base)

        ydl_options: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "paths": {"home": str(output_path)},
            "outtmpl": {"default": f"{filename_base}.%(ext)s"},
            "format": format_selector or self._format_selector_from_options(selected_format, effective_audio_options),
        }

        postprocessors: list[dict[str, Any]] = []

        container = effective_audio_options.container
        if container != "original":
            preferred_codec = "m4a" if container in ("m4a", "auto") else container
            postprocessors.append({
                "key": "FFmpegExtractAudio",
                "preferredcodec": preferred_codec,
                "preferredquality": "192",
            })

        if effective_audio_options.embed_metadata:
            postprocessors.append({"key": "FFmpegMetadata", "add_metadata": True})

        if effective_audio_options.embed_thumbnail:
            postprocessors.append({"key": "EmbedThumbnail"})
            ydl_options["writethumbnail"] = True

        if postprocessors:
            ydl_options["postprocessors"] = postprocessors

        if progress_callback is not None:
            ydl_options["progress_hooks"] = [
                lambda data: self._emit_progress(data, resolved_video, progress_callback)
            ]

        metadata_to_inject: dict[str, Any] = {}
        if effective_audio_options.embed_metadata:
            title = _pick_metadata_text(resolved_video.title)
            artist = _pick_metadata_text(resolved_video.artist, resolved_video.uploader, resolved_video.channel)
            album = _pick_metadata_text(resolved_video.album, resolved_video.playlist_title)
            if title:
                metadata_to_inject["title"] = title
            if artist:
                metadata_to_inject["artist"] = artist
            if album:
                metadata_to_inject["album"] = album

        try:
            target = resolved_video.url or self._video_url_from_info(resolved_video)
            if not target:
                raise ValueError("A video URL or id is required")
            with yt_dlp.YoutubeDL(cast(Any, ydl_options)) as ydl:
                if metadata_to_inject:
                    ydl.add_post_processor(_MetadataInjectorPP(ydl, metadata_to_inject))
                info = ydl.extract_info(target, download=True)
        except Exception as exc:
            logger.warning("yt-dlp download failed for %r: %s", resolved_video.url or resolved_video.video_id, exc)
            raise

        filepath = _normalize_text(info.get("_filename") if isinstance(info, dict) else None)
        if not filepath and isinstance(info, dict):
            filepath = _normalize_text(info.get("filepath"))
        if not filepath and isinstance(info, dict):
            filepath = _normalize_text(info.get("requested_downloads", [{}])[0].get("filepath")) if info.get("requested_downloads") else None

        if not filepath:
            filepath = str(output_path / f"{filename_base}.unknown")

        return DownloadResult(
            video=resolved_video,
            filepath=filepath,
            requested_format_id=format_id,
            selected_format=selected_format,
            title=resolved_video.title,
            video_id=resolved_video.video_id,
        )

    def download_track(self, video_id: str, output_dir: str, audio_format: str = "m4a") -> str | None:
        """Compatibility wrapper for legacy callers.

        It resolves the video first, then downloads with the format selector
        provided by the caller.
        """
        try:
            result = self.download(
                f"https://www.youtube.com/watch?v={video_id}",
                output_dir=output_dir,
                format_selector=f"bestaudio[ext={audio_format}]/bestaudio/best",
            )
        except Exception:
            return None
        return result.filepath

    def _coerce_video_info(self, video: VideoInfo | SearchResult | str) -> VideoInfo:
        if isinstance(video, VideoInfo):
            return video
        if isinstance(video, SearchResult):
            url = video.url or self._video_url_from_id(video.video_id)
            if not url:
                raise ValueError("SearchResult requires url or video_id to download")
            resolved = self.get_video_info(url)
            if resolved is None:
                raise ValueError(f"Unable to resolve video metadata for {url!r}")
            return resolved

        url = video if "://" in video else self._video_url_from_id(video)
        if not url:
            raise ValueError("A video URL or id is required")
        resolved = self.get_video_info(url)
        if resolved is None:
            raise ValueError(f"Unable to resolve video metadata for {url!r}")
        return resolved

    def _select_format(
        self,
        video: VideoInfo,
        format_id: str | None,
        audio_options: AudioDownloadOptions | None = None,
    ) -> FormatInfo | None:
        if not video.formats:
            return None

        if format_id is None:
            return self._select_audio_format(video, audio_options or AudioDownloadOptions())

        selected = next((fmt for fmt in video.formats if fmt.format_id == format_id), None)
        if selected is None:
            raise ValueError(f"Format {format_id!r} is not available for this video")
        return selected

    def _select_audio_format(self, video: VideoInfo, audio_options: AudioDownloadOptions) -> FormatInfo | None:
        audio_formats = [fmt for fmt in video.formats if fmt.is_audio_only]
        if not audio_formats:
            return None

        target_bitrate = self._target_bitrate(audio_options.quality)
        container_rank = self._container_rank_map(audio_formats, audio_options.container)

        def score(fmt: FormatInfo) -> tuple[int, float, float, float]:
            bitrate = fmt.tbr if fmt.tbr is not None else 0.0
            if target_bitrate is None:
                return (0, float(container_rank.get(fmt.format_id, 99)), -bitrate, -(fmt.filesize or 0))

            if bitrate >= target_bitrate:
                quality_rank = 0
                quality_distance = bitrate - target_bitrate
            else:
                quality_rank = 1
                quality_distance = target_bitrate - bitrate

            return (quality_rank, quality_distance, float(container_rank.get(fmt.format_id, 99)), -(fmt.filesize or 0))

        return min(audio_formats, key=score)

    def _format_selector_from_options(
        self,
        selected_format: FormatInfo | None,
        audio_options: AudioDownloadOptions,
    ) -> str:
        if selected_format is not None:
            return selected_format.format_id

        quality = audio_options.quality
        container = audio_options.container

        if quality == "best" and container == "opus":
            return "bestaudio[acodec=opus]/bestaudio/best"
        if quality == "best" and container == "m4a":
            return "bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio[acodec=aac]/bestaudio/best"
        if quality == "best" and container == "original":
            return "bestaudio/best"

        target = self._target_bitrate(quality)
        if target is None:
            return "bestaudio/best"

        if container == "opus":
            return f"bestaudio[acodec=opus][abr>={target}]/bestaudio[acodec=opus]/bestaudio[abr>={target}]/bestaudio/best"
        if container == "m4a":
            return f"bestaudio[ext=m4a][abr>={target}]/bestaudio[ext=mp4][abr>={target}]/bestaudio[acodec=aac][abr>={target}]/bestaudio[abr>={target}]/bestaudio/best"
        if container == "original":
            return f"bestaudio[abr>={target}]/bestaudio/best"
        return f"bestaudio[abr>={target}]/bestaudio/best"

    def _container_rank_map(
        self,
        formats: list[FormatInfo],
        container: Literal["auto", "m4a", "opus", "original"],
    ) -> dict[str, int]:
        if container == "original":
            return {fmt.format_id: 0 for fmt in formats}

        if container == "opus":
            preferred = {"opus": 0, "webm": 0, "m4a": 1, "mp4": 1, "aac": 1}
        elif container == "m4a":
            preferred = {"m4a": 0, "mp4": 0, "aac": 0, "opus": 1, "webm": 1}
        else:
            preferred = {"opus": 0, "webm": 1, "m4a": 2, "mp4": 2, "aac": 2}

        def rank(fmt: FormatInfo) -> int:
            codec = (fmt.audio_ext or fmt.ext or "").lower()
            return preferred.get(codec, 3)

        return {fmt.format_id: rank(fmt) for fmt in formats}

    def _target_bitrate(self, quality: Literal["best", "high", "medium", "low"]) -> int | None:
        if quality == "high":
            return 160
        if quality == "medium":
            return 128
        if quality == "low":
            return 64
        return None

    def _video_url_from_info(self, video: VideoInfo) -> str | None:
        return video.url or self._video_url_from_id(video.video_id)

    def _video_url_from_id(self, video_id: str | None) -> str | None:
        if not video_id:
            return None
        return f"https://www.youtube.com/watch?v={video_id}"

    def _emit_progress(self, data: Mapping[str, Any], video: VideoInfo, callback: ProgressCallback) -> None:
        status = _normalize_text(data.get("status")) or "unknown"
        downloaded = _normalize_int(data.get("downloaded_bytes"))
        total = _normalize_int(data.get("total_bytes") or data.get("total_bytes_estimate"))
        percent = None
        if downloaded is not None and total:
            percent = round((downloaded / total) * 100.0, 2)
        callback(
            DownloadProgress(
                status=status,
                downloaded_bytes=downloaded,
                total_bytes=total,
                percent=percent,
                eta_seconds=_normalize_int(data.get("eta")),
                speed_bytes_per_second=_normalize_float(data.get("speed")),
                filename=_normalize_text(data.get("filename")),
                video_id=video.video_id,
                title=video.title,
            )
        )

    def _extract_info(self, target: str, options: Mapping[str, Any] | None = None) -> dict[str, Any] | None:
        ytdlp_options = dict(self._base_options)
        if options:
            ytdlp_options.update(dict(options))

        try:
            with yt_dlp.YoutubeDL(cast(Any, ytdlp_options)) as ydl:
                info = ydl.extract_info(target, download=False)
        except Exception as exc:
            logger.warning("yt-dlp metadata discovery failed for %r: %s", target, exc)
            return None

        if isinstance(info, dict):
            return cast(dict[str, Any], info)

        logger.warning("yt-dlp returned unexpected metadata type for %r: %s", target, type(info).__name__)
        return None

    def _search_youtube(self, query: str, limit: int) -> list[SearchResult]:
        search_target = f"ytsearch{limit}:{query}"
        raw = self._extract_info(search_target, {"extract_flat": True})
        if not raw:
            return []

        results: list[SearchResult] = []
        for index, entry in enumerate(_iter_entries(raw), start=1):
            results.append(SearchResult.from_ydl(entry, search_position=index))
        return results

    def _search_ytmusic_songs(self, query: str, limit: int) -> list[SearchResult]:
        try:
            results = YTMusic().search(query, filter="songs", limit=limit)
        except Exception as exc:
            logger.warning("YTMusic search failed for %r: %s", query, exc)
            return []

        songs: list[SearchResult] = []
        for index, item in enumerate(results, start=1):
            if not isinstance(item, Mapping):
                continue
            songs.append(_search_result_from_ytmusic(item, search_position=index))
        return songs[:limit]


class YoutubeDownloader(YoutubeMetadataDiscovery):
    """Backward-compatible alias for the discovery-only client."""


YouTubeDownloader = YoutubeDownloader


def _search_result_from_ydl(data: Mapping[str, Any], search_position: int | None = None) -> SearchResult:
    video_id = _extract_video_id(data)
    url = _extract_webpage_url(data, video_id)
    thumbnail_url = _extract_thumbnail_url(data)
    return SearchResult(
        video_id=video_id,
        title=str(data.get("title") or ""),
        artist=_normalize_text(data.get("artist") or data.get("uploader") or data.get("channel")),
        album=_extract_album_name(data),
        url=url,
        thumbnail_url=thumbnail_url,
        duration_seconds=_normalize_int(data.get("duration")),
        source="youtube",
        uploader=_normalize_text(data.get("uploader")),
        channel=_normalize_text(data.get("channel")),
        search_position=search_position,
    )


def _search_result_from_ytmusic(data: Mapping[str, Any], search_position: int | None = None) -> SearchResult:
    video_id = _normalize_text(data.get("videoId") or data.get("video_id"))
    url = _normalize_text(data.get("url") or data.get("videoUrl"))
    if not url and video_id:
        url = f"https://www.youtube.com/watch?v={video_id}"

    thumbnails = [item for item in _normalize_list(data.get("thumbnails")) if isinstance(item, Mapping)]
    thumbnail_url = None
    if thumbnails:
        thumbnail_url = _normalize_text(thumbnails[-1].get("url"))

    artists = _normalize_list(data.get("artists"))
    artist = ", ".join(
        name
        for name in (
            _normalize_text(artist_item.get("name")) if isinstance(artist_item, Mapping) else None
            for artist_item in artists
        )
        if name
    ) or None

    duration_seconds = _normalize_int(data.get("duration_seconds") or data.get("lengthSeconds") or data.get("duration"))

    return SearchResult(
        video_id=video_id,
        title=str(data.get("title") or ""),
        artist=artist,
        album=_extract_album_name(data),
        url=url,
        thumbnail_url=thumbnail_url,
        duration_seconds=duration_seconds,
        source="ytmusic",
        uploader=_normalize_text(data.get("uploader")),
        channel=_normalize_text(data.get("channel")),
        search_position=search_position,
    )


def _video_info_from_ydl(data: Mapping[str, Any]) -> VideoInfo:
    video_id = _extract_video_id(data)
    url = _extract_webpage_url(data, video_id)
    thumbnails = tuple(_thumbnail_from_ydl(item) for item in _normalize_list(data.get("thumbnails")))
    thumbnails = tuple(item for item in thumbnails if item is not None)
    formats = tuple(_format_from_ydl(item) for item in _normalize_list(data.get("formats")))
    formats = tuple(item for item in formats if item is not None)

    return VideoInfo(
        video_id=video_id,
        title=str(data.get("title") or ""),
        artist=_normalize_text(data.get("artist") or data.get("uploader") or data.get("channel")),
        album=_extract_album_name(data),
        url=url,
        thumbnail_url=_extract_thumbnail_url(data),
        duration_seconds=_normalize_int(data.get("duration")),
        uploader=_normalize_text(data.get("uploader")),
        channel=_normalize_text(data.get("channel")),
        description=_normalize_text(data.get("description")),
        upload_date=_normalize_text(data.get("upload_date")),
        view_count=_normalize_int(data.get("view_count")),
        like_count=_normalize_int(data.get("like_count")),
        availability=_normalize_text(data.get("availability")),
        extractor_key=_normalize_text(data.get("extractor_key") or data.get("extractor")),
        is_live=bool(data.get("is_live")),
        tags=tuple(str(tag) for tag in _normalize_list(data.get("tags")) if tag is not None),
        thumbnails=thumbnails,
        formats=formats,
        playlist_id=_normalize_text(data.get("playlist_id")),
        playlist_title=_normalize_text(data.get("playlist_title")),
        playlist_index=_normalize_int(data.get("playlist_index")),
    )


def _playlist_info_from_ydl(data: Mapping[str, Any]) -> PlaylistInfo:
    entries = tuple(
        PlaylistEntry.from_ydl(entry)
        for entry in _iter_entries(data)
    )
    playlist_title = str(data.get("title") or "")
    return PlaylistInfo(
        playlist_id=_normalize_text(data.get("id")),
        title=playlist_title,
        url=_normalize_text(data.get("webpage_url") or data.get("url")),
        author=_normalize_text(data.get("uploader") or data.get("channel") or data.get("creator")),
        item_count=_normalize_int(data.get("playlist_count")) or len(entries),
        entries=entries,
        album=_extract_album_name(data),
        thumbnail_url=_extract_thumbnail_url(data),
        description=_normalize_text(data.get("description")),
    )


def _playlist_entry_from_ydl(data: Mapping[str, Any]) -> PlaylistEntry:
    video_id = _extract_video_id(data)
    url = _extract_webpage_url(data, video_id)
    return PlaylistEntry(
        video_id=video_id,
        title=str(data.get("title") or ""),
        artist=_normalize_text(data.get("artist") or data.get("uploader") or data.get("channel")),
        album=_extract_album_name(data),
        url=url,
        thumbnail_url=_extract_thumbnail_url(data),
        duration_seconds=_normalize_int(data.get("duration")),
        uploader=_normalize_text(data.get("uploader")),
        channel=_normalize_text(data.get("channel")),
        playlist_index=_normalize_int(data.get("playlist_index")),
    )


def _thumbnail_from_ydl(data: Mapping[str, Any]) -> ThumbnailInfo | None:
    url = _normalize_text(data.get("url"))
    if not url:
        return None
    return ThumbnailInfo(
        url=url,
        width=_normalize_int(data.get("width")),
        height=_normalize_int(data.get("height")),
    )


def _format_from_ydl(data: Mapping[str, Any]) -> FormatInfo | None:
    format_id = _normalize_text(data.get("format_id"))
    if not format_id:
        return None
    return FormatInfo(
        format_id=format_id,
        ext=_normalize_text(data.get("ext")),
        format_note=_normalize_text(data.get("format_note")),
        resolution=_normalize_text(data.get("resolution")),
        width=_normalize_int(data.get("width")),
        height=_normalize_int(data.get("height")),
        fps=_normalize_float(data.get("fps")),
        tbr=_normalize_float(data.get("tbr")),
        filesize=_normalize_int(data.get("filesize") or data.get("filesize_approx")),
        audio_ext=_normalize_text(data.get("audio_ext")),
        video_ext=_normalize_text(data.get("video_ext")),
        vcodec=_normalize_text(data.get("vcodec")),
        acodec=_normalize_text(data.get("acodec")),
        protocol=_normalize_text(data.get("protocol")),
        url=_normalize_text(data.get("url")),
        is_audio_only=bool(data.get("acodec") and data.get("acodec") != "none" and data.get("vcodec") == "none"),
        is_video_only=bool(data.get("vcodec") and data.get("vcodec") != "none" and data.get("acodec") == "none"),
    )


def _extract_video_id(data: Mapping[str, Any]) -> str | None:
    raw = data.get("id") or data.get("video_id")
    if raw:
        return str(raw)

    return _extract_video_id_from_url(_normalize_text(data.get("url") or data.get("webpage_url")))


def _extract_video_id_from_url(url: str | None) -> str | None:
    if not url:
        return None

    parsed = urlparse(url)
    if parsed.netloc in {"youtu.be", "www.youtu.be"}:
        candidate = parsed.path.strip("/")
        return candidate or None

    query = parse_qs(parsed.query)
    if query.get("v"):
        return query["v"][0] or None

    path = parsed.path.strip("/")
    if "/shorts/" in parsed.path:
        return parsed.path.split("/shorts/", 1)[1].split("/", 1)[0] or None
    if path.startswith("watch"):
        return query.get("v", [None])[0]

    return path or None


def _extract_webpage_url(data: Mapping[str, Any], video_id: str | None) -> str | None:
    url = _normalize_text(data.get("webpage_url") or data.get("url"))
    if url:
        return url
    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}"
    return None


def _extract_thumbnail_url(data: Mapping[str, Any]) -> str | None:
    thumbnail = _normalize_text(data.get("thumbnail"))
    if thumbnail:
        return thumbnail

    thumbnails = [item for item in _normalize_list(data.get("thumbnails")) if isinstance(item, Mapping)]
    best_url = None
    best_score = (-1, -1)
    for item in thumbnails:
        url = _normalize_text(item.get("url"))
        if not url:
            continue
        score = (_normalize_int(item.get("width")) or 0, _normalize_int(item.get("height")) or 0)
        if score >= best_score:
            best_score = score
            best_url = url
    return best_url


def _extract_album_name(data: Mapping[str, Any]) -> str | None:
    album = data.get("album") or data.get("album_title") or data.get("playlist_title")
    if isinstance(album, Mapping):
        return _normalize_text(album.get("name") or album.get("title"))
    return _normalize_text(album)


def _iter_entries(data: Mapping[str, Any]) -> list[dict[str, Any]]:
    entries = data.get("entries")
    if isinstance(entries, dict):
        return [cast(dict[str, Any], entries)]
    if not entries:
        return []
    return [cast(dict[str, Any], entry) for entry in entries if isinstance(entry, Mapping)]


def _normalize_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _normalize_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_filename_component(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value)
    cleaned = cleaned.strip().strip(".")
    return cleaned or "untitled"


def _pick_metadata_text(*values: str | None) -> str | None:
    for value in values:
        if value is None:
            continue
        text = value.strip()
        if not text:
            continue
        if text.lower() in {"unknown", "n/a", "na", "none", "null"}:
            continue
        return text
    return None


__all__ = [
    "AudioDownloadOptions",
    "DownloadProgress",
    "DownloadResult",
    "DownloaderAuth",
    "FormatInfo",
    "PlaylistEntry",
    "PlaylistInfo",
    "SearchResult",
    "ThumbnailInfo",
    "VideoInfo",
    "YoutubeDownloader",
    "YoutubeMetadataDiscovery",
    "YouTubeDownloader",
    "classify_download_error",
    "friendly_download_error",
]
