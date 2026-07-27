# Downloader Module

## Purpose

The downloader module is responsible for interacting with YouTube Music and YouTube through yt-dlp.

Its goal is to provide a download experience similar to yt-dlp while exposing a clean Python API for the rest of the backend.

The module should never contain metadata enrichment logic. Its only responsibility is downloading media and returning basic information.

---

# Responsibilities

The downloader must:

- Search songs from text queries.
- Search albums.
- Search playlists.
- Search artists when supported.
- Retrieve playlist metadata without downloading.
- Retrieve video metadata without downloading.
- Download one or multiple selected items.
- Support very large playlists.
- Allow downloading only selected items from a playlist.
- Expose available formats before downloading.
- Download audio or video.
- Return download progress.
- Support cancellation.
- Generate safe filenames.
- Embed the initial metadata available from YouTube.
- Return enough information for the metadata pipeline to continue.

---

# Architecture

The downloader is divided into two stages.

## Phase 1

Metadata discovery.

Uses yt-dlp in extraction mode.

Responsibilities:

- search
- playlist extraction
- metadata extraction
- available formats
- thumbnails
- duration
- uploader
- channel
- video id

No download happens here.

---

## Phase 2

Download.

Uses the information obtained during phase 1.

Responsibilities:

- download selected format
- audio conversion
- filename generation
- progress callbacks
- cancellation
- temporary files
- cleanup

---

# Supported Operations

## Search

Input

- text query

Output

List of results containing:

- title
- artist
- duration
- thumbnail
- video_id
- url

---

## Playlist Inspection

Input

playlist url

Output

Playlist object containing:

- title
- author
- number of items
- entries

Each entry should contain enough information to be downloaded independently.

No download should happen.

---

## Download

Input

Selected entries

Options:

- audio/video
- codec
- bitrate
- format
- output folder

Output

Downloaded file path.

---

# Playlist Requirements

The downloader must support playlists with hundreds or thousands of entries.

Requirements:

- Lazy processing when possible.
- Never require downloading the whole playlist.
- Allow selecting only specific entries.
- Preserve playlist ordering.

---

# File Naming

Default format:

```
{title} [{video_id}].m4a
```

The naming strategy should be customizable later.

---

# Integration

The downloader should return enough information for the metadata pipeline.

Typical flow:

Search

↓

User selects result

↓

Downloader downloads

↓

Extractor reads initial metadata

↓

Matcher enriches metadata

↓

Writer saves final metadata

---

# Error Handling

Network failures must not crash the application.

Errors should include:

- extraction failure
- unavailable video
- unavailable playlist
- geo restriction
- copyright restriction
- authentication required
- download failure

---

# Future Features

Not required initially.

Possible future additions:

- Resume downloads.
- Multiple simultaneous downloads.
- Download queue.
- Playlist synchronization.
- Download history.
- Cookie support.
- SponsorBlock.
- Subtitle download.
- Chapter support.

---

# Non Goals

This module must NOT:

- enrich metadata
- call providers
- search lyrics
- write tags
- calculate confidence
- perform matching

Those responsibilities belong to other modules.

---

# Notes

The downloader should behave similarly to yt-dlp from the user's perspective while exposing a much simpler API for the backend.