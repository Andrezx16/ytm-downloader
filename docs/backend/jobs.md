# Jobs Module

Generic background job lifecycle manager. Independent from FastAPI, HTTP, and frontend. Reusable by any backend module.

## Responsibilities
Create jobs, track progress, update state, store results/errors, cancel jobs, clean finished jobs.

## Not Responsible For
Downloading media, metadata extraction/writing, HTTP responses, WebSocket handling.

## Public Classes
- `JobState` — `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`. Terminal states: COMPLETED, FAILED, CANCELLED (cannot return to RUNNING).
- `Job` — `id`, `state`, `progress`, `message`, `created_at`, `started_at`, `finished_at`, `result`, `error`, `metadata`
- `JobManager` — manages all active jobs

## Job Fields
- **id**: unique identifier (e.g. `7a8d0f4d...`)
- **progress**: float 0.0–100.0, always increasing
- **message**: human-readable status (e.g. "Downloading...", "Writing metadata...")
- **result**: stores backend return value (DownloadResult, PlaylistDownloadResult, PipelineResult). Jobs module doesn't interpret it.
- **error**: exception from execution, preserved for diagnostics
- **metadata**: optional dict — `current_song`, `playlist_title`, `video_title`, `provider`, etc.

## JobManager Methods
- `create() → Job` — initial state QUEUED
- `start(callable)` — execute in asyncio task/thread/executor (implementation unspecified)
- `get(id) → Job | None`
- `cancel(id)` — cooperative cancellation via backend module (e.g. `Downloader.cancel()`)
- `remove(id)` — remove completed jobs only
- `cleanup()` — remove expired finished jobs (configurable: max age, max count, manual)

## Progress Updates
Jobs expose `progress`, `message`, `metadata`. Backend modules update these directly.

## Result Flow
```
create → queued → running → completed (result available)
create → queued → running → failed (error available)
```

## Cancellation
Cooperative. JobManager requests cancellation; backend module decides when to stop safely. Example: `Downloader.cancel()` → download loop exits → job becomes CANCELLED.

## Thread Safety
Must support concurrent access. Internal state synchronized via threading locks (or asyncio locks). No assumptions about execution model.

## Memory Management
Finished jobs don't persist forever. Configurable: maximum lifetime, maximum stored jobs, explicit deletion.

## Logging
Log: job creation, completion, failures, cancellation. Never print to stdout.

## Events
Jobs module does not communicate with clients. Exposes job state only. Other layers (API) handle polling/SSE/WebSockets. Transport-independent.

## Backend Integration
Works with any module (Downloader, PlaylistDownloader, MetadataPipeline). Never depends on implementations — only returned results.

## API Integration
API uses JobManager instead of own task tracking: `HTTP Request → JobManager.create() → Backend Module → Job updated → HTTP Response`. API stays thin.

## Design
Generic, transport-independent, thread-safe, reusable, lightweight, backend-agnostic. No business logic.
