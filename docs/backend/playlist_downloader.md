# Playlist Downloader

Manages YouTube playlists independently from single-track downloads. Orchestrates extraction, selection, progress tracking, batch downloads. **Must never implement own download engine** — all downloads delegated to `YoutubeDownloader.download()`.

## Responsibilities
Extract playlist metadata, support any size, manage song selection, coordinate multiple downloads, report playlist + current song progress, handle failures gracefully, reuse metadata, avoid duplicated yt-dlp requests.

## Not Responsible For
Search, individual video downloads, download logic (belongs to YoutubeDownloader), audio metadata, frontend code, API routes, music matching.

## Architecture
```
User → PlaylistDownloader → YoutubeDownloader → yt-dlp
```
YoutubeDownloader is single source of truth for every individual download.

## Public API

### get_playlist(url) → PlaylistInfo
One yt-dlp extraction. Supports 1000+ entries.

### download(playlist | url, selected=[...])
Accepts PlaylistInfo or URL. If PlaylistInfo provided, metadata not re-fetched.

### cancel()
Stops gracefully. Current song may finish; remaining songs don't start.

### summary() / print_summary()
CLI debugging.

## PlaylistInfo
Properties: `title`, `description`, `uploader`, `thumbnail`, `playlist_id`, `total_tracks`, `total_duration`, `entries`. Computed: `selected_entries`, `selected_indices`, `selected_count`, `selected_duration`, `has_selection`, `is_empty`. Methods: `get_entry()`, `select()`, `unselect()`, `toggle()`, `select_all()`, `unselect_all()`, `clear_selection()`, `summary()`, `to_dict()`, `to_json()`. Supports `len()`, indexing, iteration.

## PlaylistEntry
Fields: `title`, `artist`, `duration`, `video_id`, `url`, `thumbnail`, `uploader`, `position`, `provider` (default: `youtube`).

## Download Options
`PlaylistDownloadOptions`: `output_directory`, `format_id`, `retries`, `overwrite`, `skip_existing`, `embed_thumbnail` (default True), `embed_metadata` (default True), `progress_callback`.

## Download Result
`PlaylistDownloadResult`: `successful`, `failed`, `skipped`, `cancelled`, `elapsed_time`, `downloaded_bytes`, `average_speed`, `output_directory`.

## Progress
Two independent states: playlist progress (e.g. "15/250 songs") and song progress (e.g. "72%"). Don't combine.

## Event Hooks
`on_playlist_start`, `on_song_start`, `on_song_progress`, `on_song_finish`, `on_song_error`, `on_playlist_finish`. Use callbacks/logging, not print().

## Error Handling
One failed song never stops playlist. Record failure, continue. Retry before giving up (default: 2 retries).

## Performance
Scale to 1000+ entries. Rules: use yt-dlp flat extraction, never `get_video_info()` per entry, never fetch same playlist twice, never duplicate metadata requests. Detailed metadata fetched only when downloading specific entry.

## Internal Cache
Cache playlist metadata in `self._playlist_cache`. Reuse on repeated requests within same session.

## Ordering
Downloads preserve playlist order exactly.

## Future Compatibility
Provider-agnostic design. Avoid assuming YouTube-only. Isolate provider-specific logic. Future: Spotify, Deezer, Apple Music.

## Logging
Python logging. Never `print()` inside library code.

## Testing
`test_playlist.py`. Scenarios: small/large/1000+ playlist, selected/full download, cancellation, retry after failure, continue after errors, cached extraction.

## Design Rules
- Downloader handles ONE item, PlaylistDownloader handles MANY
- PlaylistDownloader never duplicates download logic
- YoutubeDownloader is single source of truth
- Playlist extraction happens once, metadata reused
- Progress is callback-driven
- Playlist order preserved
- One failed song never aborts playlist
- Frontends contain no playlist business logic
