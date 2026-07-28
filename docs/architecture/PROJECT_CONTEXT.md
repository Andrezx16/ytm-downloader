# Project Context

## What This Is
Python backend for enriching local audio file metadata (MP3, M4A, FLAC). Extracts basic info from file, queries multiple metadata sources in parallel, ranks candidates, allows manual selection, writes final metadata back. Engine for future Tauri desktop app; reusable from Android/web/CLI.

## Implemented Modules
- `extractor.py` — reads existing metadata via mutagen
- `matcher.py` — orchestrates providers, calculates confidence
- `writer.py` — writes tags for MP3/M4A/FLAC, cover art, lyrics
- `lyrics.py` — fetches lyrics via syncedlyrics with multi-service fallback
- `providers/base.py` — `MusicProvider` ABC
- `providers/deezer.py` — no API key
- `providers/apple.py` — iTunes Search API
- `providers/musicbrainz.py` — internal rate limit
- `providers/lastfm.py` — requires `LASTFM_API_KEY`
- `providers/ytmusic.py` — useful when videoId available
- `downloader.py` — yt-dlp wrapper, 2-phase (fetch metadata → download), embeds initial YouTube metadata
- `api.py` — FastAPI HTTP layer
- `jobs.py` — generic background job lifecycle
- `pipeline.py` — orchestration layer

## Pipeline Flow
1. Read existing metadata from local file
2. Query all enabled providers in parallel
3. Matcher calculates confidence (title, artist, duration, album similarity)
4. Return sorted candidate list
5. User selects best candidate
6. Fill missing fields from other found candidates
7. Optional Deezer detail fetch for track/disc number, ISRC, year
8. Fetch lyrics
9. Write metadata to file

## Active Providers
Deezer, Apple (iTunes), MusicBrainz, Last.fm. YTMusic available when videoId present. Spotify excluded (Premium required after Feb 2026).

## Decisions (do not revisit)
- No AcoustID
- No Apple Music API (cost/complexity)
- No BetterLyrics as primary source
- No Spotify as default provider

## Architecture Rules
- Backend independent of frontend
- Providers isolated, no cross-knowledge
- Business logic in pipeline, not UI
- One file at a time
- Frontend talks via API only, never directly to providers
- Log network failures, never break full flow
- Don't rewrite working modules
- Prioritize: downloader → API → rate limiter → frontend

## Testing
```bash
python test.py "path/to/file.mp3"
```
