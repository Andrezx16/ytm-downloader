# Architecture

## Layers
1. **Entry** — local CLI client or future Tauri frontend
2. **Application** — metadata pipeline, business rules
3. **Integration** — external providers, file utilities
4. **Persistence** — tag writing on local files

Backend is source of truth; frontend consumes results only.

```text
Client / Frontend → FastAPI (future) → Pipeline
                                         ├─ Extractor
                                         ├─ Matcher
                                         ├─ Lyrics
                                         ├─ Writer
                                         └─ Providers
```

## Modules

### Extractor
Reads current metadata from local file via mutagen. Input to matching.

### Matcher
Coordinates concurrent provider searches, calculates RapidFuzz weighted score, ranks candidates, fills missing fields from existing results.

### Providers
Each implements `MusicProvider` ABC, returns uniform `MatchCandidate` TypedDict. No cross-dependencies. No knowledge of matching logic.

### Lyrics
Fetches lyrics via syncedlyrics. Async to avoid blocking event loop.

### Writer
Writes final tags for MP3, M4A/AAC, FLAC. Handles cover art, lyrics, standard tags. Receives simple dict of final fields.

## Data Models

**FileInfo** — extracted from local file: `title`, `artist`, `album`, `duration_ms`

**MatchCandidate** — provider result: `source`, `source_id`, `title`, `artist`, `album`, `album_artist`, `year`, `genre`, `track_number`, `disc_number`, `isrc`, `composer`, `duration_ms`, `cover_url`, `confidence`

**FinalMetadata** — written to file: `title`, `artist`, `album`, `album_artist`, `year`, `genre`, `track_number`, `disc_number`, `isrc`, `composer`, `publisher`, `cover_url`, `lyrics`

## Execution Flow
1. Read file from disk → build FileInfo
2. Concurrent provider searches
3. Confidence calculation, candidate ranking
4. Select best candidate (or manual choice)
5. Fill missing fields from existing results
6. Fetch lyrics
7. Write metadata to file

## Design Principles
- Providers isolated and replaceable, no cross-dependencies
- Log errors/network failures, never fail silently
- Typed, clear data structures
- Backend independent of frontend
- Incremental design — don't rewrite working modules

## Future Extensions
- downloader.py — metadata/videoId extraction from YouTube
- api.py — HTTP pipeline exposure
- rate limiter global — external API rate control
- frontend Tauri — interactive candidate selection
- folder watcher — auto-detect new files
