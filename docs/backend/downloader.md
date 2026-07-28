# Downloader Module

Interacts with YouTube/YouTube Music via yt-dlp. Download experience similar to yt-dlp with clean Python API. Never contains metadata enrichment logic — only downloads media and returns basic info.

## Responsibilities
Search songs/albums/playlists/artists. Retrieve playlist/video metadata without downloading. Download selected items. Support large playlists. Expose formats. Download audio or video. Return progress. Support cancellation. Generate safe filenames. Embed initial YouTube metadata. Return enough info for metadata pipeline.

## Architecture (2 Phases)

**Phase 1 — Metadata Discovery** (yt-dlp extraction mode): search, playlist extraction, metadata, formats, thumbnails, duration, uploader, channel, video_id. No download.

**Phase 2 — Download**: format selection, audio conversion, filename generation, progress callbacks, cancellation, temp files, cleanup.

## Operations

**Search** — Input: text query. Output: list of `{title, artist, duration, thumbnail, video_id, url}`.

**Playlist Inspection** — Input: playlist URL. Output: `{title, author, number_of_items, entries}`. One yt-dlp extraction only. No download.

**Download** — Input: selected entries + options (audio/video, codec, bitrate, format, output folder). Output: file path.

## Playlist Requirements
Support 1000+ entries. Lazy processing. Never require full playlist download. Allow selecting specific entries. Preserve ordering.

## File Naming
Default: `{title} [{video_id}].m4a`. Customizable later.

## Integration Flow
Search → User selects → Downloader downloads → Extractor reads initial metadata → Matcher enriches → Writer saves

## Error Handling
Network failures must not crash. Handle: extraction failure, unavailable video/playlist, geo/copyright restriction, auth required, download failure.

## Non-Goals
Must NOT: enrich metadata, call providers, search lyrics, write tags, calculate confidence, perform matching.

## Future
Resume downloads, multiple simultaneous, download queue, playlist sync, history, cookies, SponsorBlock, subtitles, chapters.
