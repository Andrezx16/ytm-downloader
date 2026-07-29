# Frontend Jobs

Shows job progress. Uses API Client only.

## Responsibilities

- Active jobs
- Job history
- Progress
- Status
- Cancel
- SSE

Never:
- start downloads
- perform HTTP outside `api/`

## Structure

```text
src/features/jobs/
├── JobsPage.tsx
├── JobList.tsx
├── JobCard.tsx
├── JobProgress.tsx
├── JobStatus.tsx
├── hooks.ts
├── store.ts
├── types.ts
└── index.ts
```

## Flow

```text
job_id
↓
subscribeJob()
↓
SSE
↓
update state
↓
UI
```

## Display

Each job shows:

- title
- progress
- state
- speed
- ETA
- output path
- error

## States

- queued
- running
- completed
- failed
- cancelled

## Hooks

Expose:

```ts
useJobs()
useJob(jobId)
```

Use:

```ts
subscribeJob()
getJob()
cancelJob()
```

No polling.

SSE only.

## Store

Keep active and completed jobs.

Update only from SSE.

## Actions

Running:

- Cancel

Completed:

- Open folder
- Clear

Failed:

- Retry (placeholder)

## Errors

Display normalized `ApiError`.

Reconnect SSE automatically.

## Compatibility

Depends on:

- Foundation
- API Client
- Layout
- Search
- Download

## Principles

Thin • Typed • Reactive • Accessible