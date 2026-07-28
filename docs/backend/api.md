# API Module

Thin FastAPI integration layer. Exposes backend via HTTP. No business logic.

## Responsibilities
- Validate requests, convert API models → backend models
- Invoke backend modules, return serialized responses
- Delegate long-running work to Jobs module
- Expose job progress via SSE

## Not Responsible For
Download logic, playlist parsing, metadata matching/writing, lyrics fetching, yt-dlp interaction, background task management.

## Structure
```text
api.py
├── FastAPI application
├── Request/Response models
├── Routers + dependency helpers
├── Exception handlers
└── Startup/shutdown hooks
```

## Request Flow
```
HTTP Request → validation → convert API model → invoke backend → convert result → HTTP Response
```
Never duplicate backend logic.

## Backend Modules Used
- `YoutubeDownloader.search()`, `.download()`
- `PlaylistDownloader.get_playlist()`, `.download()`
- `MetadataPipeline.analyze_file()`, `.enrich_file()`, `.write_metadata()`
- `JobManager` — create, start, status, cancel, stream progress

## Jobs
Long-running operations (single download, playlist download, metadata enrichment) execute through Jobs module. API returns `job_id` immediately without waiting. API never implements its own job tracking.

## Job States
`queued → running → completed | failed | cancelled`. Terminal states cannot return to RUNNING.

## Progress
Provided by Jobs module. Exposed via SSE (preferred) or WebSockets. Backend modules don't know about HTTP. API never implements separate progress tracking.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/search` | `YoutubeDownloader.search(...)` → results |
| POST | `/download` | Background download → `job_id` |
| POST | `/playlist` | `PlaylistDownloader.get_playlist(...)` → metadata |
| POST | `/playlist/download` | Playlist download → `job_id` |
| POST | `/pipeline/analyze` | `MetadataPipeline.analyze_file(...)` |
| POST | `/pipeline/enrich` | `MetadataPipeline.enrich_file(...)` |
| POST | `/pipeline/write` | `MetadataPipeline.write_metadata(...)` → 204 |
| GET | `/jobs/{id}` | Current job state (state, progress, message, result, error) |
| GET | `/jobs/{id}/events` | SSE progress stream |
| POST | `/jobs/{id}/cancel` | Cooperative cancellation |

## Models
API owns its own request/response models. Backend modules must never import API models.

## Error Handling
Translate backend exceptions → HTTP responses. Status codes: 400 (ValueError), 404 (FileNotFoundError/OSError), 409 (RuntimeError), 422 (IndexError), 500 (generic). Log unexpected exceptions.

## Startup
Configure logging, create shared `JobManager`, initialize reusable `MetadataPipeline` (shared providers).

## Shutdown
Release shared resources: MetadataPipeline, HTTP clients, providers. Use existing async cleanup.

## Logging
Log: incoming requests, job creation/completion/cancellation/failures. Never print to stdout.

## Thread Safety
Multiple concurrent clients. Avoid mutable global state. Share services safely via JobManager. Backend modules must remain reusable and independent.

## Compatibility
Must not modify public interfaces of: `downloader.py`, `playlist_downloader.py`, `pipeline.py`, `jobs.py`, `matcher.py`, `extractor.py`, `writer.py`, `lyrics.py`. API is only an integration layer.

## Design
Thin, async, modular, typed, backend-agnostic, stateless where possible. No business logic.
