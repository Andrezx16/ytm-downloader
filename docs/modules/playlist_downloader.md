# Playlist Downloader

## Purpose

The Playlist Downloader is responsible for managing YouTube playlists independently from single-track downloads.

Its purpose is to orchestrate playlist extraction, song selection, progress tracking, and batch downloads while reusing the existing `YoutubeDownloader`.

This module must NEVER implement its own download engine.

All individual downloads must be delegated to `YoutubeDownloader.download()`.

---

# Responsibilities

The Playlist Downloader is responsible for:

- Extracting playlist metadata.
- Supporting playlists of any size.
- Managing user song selection.
- Coordinating multiple downloads.
- Reporting playlist progress.
- Reporting current song progress.
- Handling download failures gracefully.
- Reusing metadata whenever possible.
- Avoiding duplicated yt-dlp requests.

---

# Non Responsibilities

This module must NOT:

- Search songs.
- Search videos.
- Download individual videos directly.
- Implement download logic already present in `YoutubeDownloader`.
- Write audio metadata.
- Communicate with frontend code.
- Handle API routes.
- Handle music matching.

---

# Architecture

```
User
        │
        ▼
PlaylistDownloader
        │
        ▼
YoutubeDownloader
        │
        ▼
yt-dlp
```

The Playlist Downloader is an orchestration layer.

YoutubeDownloader remains the single source of truth for every individual download.

---

# Public API

## Playlist extraction

```python
get_playlist(url: str) -> PlaylistInfo
```

Extracts playlist metadata.

Should only perform ONE yt-dlp extraction.

Must support playlists with hundreds or thousands of entries.

---

## Download

```python
download(playlist)

download(url)

download(
    playlist,
    selected=[...]
)
```

Accepted inputs:

- PlaylistInfo
- playlist URL

If a PlaylistInfo object is provided, metadata must NOT be fetched again.

---

## Cancel

```python
cancel()
```

Stops the playlist download gracefully.

Current song may finish depending on implementation.

Remaining songs should not start.

---

## Summary

```python
playlist.summary()

or

playlist.print_summary()
```

Useful for CLI debugging.

---

# PlaylistInfo

PlaylistInfo is more than a data container.

It manages playlist state.

Properties

- title
- description
- uploader
- thumbnail
- playlist_id
- total_tracks
- total_duration
- entries

Computed properties

- selected_entries
- selected_indices
- selected_count
- selected_duration
- has_selection
- is_empty

Methods

```python
get_entry(index)

select(indices)

unselect(indices)

toggle(index)

select_all()

unselect_all()

clear_selection()

summary()

to_dict()

to_json()
```

PlaylistInfo should support:

```python
len(playlist)

playlist[5]

for song in playlist:
    ...
```

---

# PlaylistEntry

Each playlist entry should contain enough information to download itself later.

Suggested fields

- title
- artist
- duration
- video_id
- url
- thumbnail
- uploader
- position
- provider

Provider should default to:

```
youtube
```

to keep future compatibility with additional providers.

---

# Download Options

Create a dedicated model.

Example

```python
PlaylistDownloadOptions
```

Suggested options

- output_directory
- format_id
- retries
- overwrite
- skip_existing
- embed_thumbnail
- embed_metadata
- progress_callback

Avoid long parameter lists.

---

# Download Result

Return a rich result object.

Suggested fields

```python
PlaylistDownloadResult
```

- successful
- failed
- skipped
- cancelled
- elapsed_time
- downloaded_bytes
- average_speed
- output_directory

---

# Progress

Expose two independent progress states.

Playlist progress

```
15 / 250 songs
```

Song progress

```
Downloading...
72%
```

Do not combine them.

Future frontends should be able to display both simultaneously.

---

# Event Hooks

Support callbacks.

Suggested hooks

```python
on_playlist_start

on_song_start

on_song_progress

on_song_finish

on_song_error

on_playlist_finish
```

The module should avoid printing directly to stdout.

Use callbacks or logging instead.

---

# Error Handling

One failed song must NEVER stop the playlist.

If one download fails:

- record the failure
- continue downloading

Retry failed downloads before giving up.

Suggested default:

```
2 retries
```

---

# Performance

The module must scale to playlists containing 1000+ entries.

Rules

- Use yt-dlp flat extraction whenever possible.
- Never call get_video_info() for every playlist entry.
- Never fetch the same playlist twice.
- Never duplicate metadata requests.
- Never duplicate download logic.

Detailed metadata should only be fetched when downloading a specific entry.

---

# Internal Cache

The downloader may cache playlist metadata.

Example

```python
self._playlist_cache
```

If the same playlist is requested twice during the same session:

Reuse the cached PlaylistInfo.

Avoid unnecessary yt-dlp calls.

---

# Ordering

Downloads must preserve playlist order.

Example

Selected:

```
5
8
20
```

Download exactly:

```
5
8
20
```

---

# Future Compatibility

The architecture should remain compatible with future providers.

Avoid assuming every playlist comes from YouTube.

Provider-specific logic should remain isolated.

Possible future providers

- Spotify
- Deezer
- Apple Music

---

# Logging

Never use print() inside library code.

Use Python logging.

CLI tools may print summaries externally.

---

# Testing

The module should be testable without any frontend.

Recommended test script

```
test_playlist.py
```

Recommended scenarios

- Small playlist
- Large playlist
- Playlist >1000 entries
- Selected downloads
- Full playlist download
- Cancellation
- Retry after failure
- Continue after errors
- Cached playlist extraction

---

# Design Rules

These rules should not change without a strong reason.

- Downloader handles ONE item.
- PlaylistDownloader handles MANY items.
- PlaylistDownloader never duplicates download logic.
- YoutubeDownloader remains the single source of truth.
- Playlist extraction happens once.
- Playlist metadata is reused.
- Progress is callback-driven.
- Playlist order is preserved.
- One failed song never aborts the playlist.
- Frontends should contain no playlist business logic.