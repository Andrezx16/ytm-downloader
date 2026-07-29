# Frontend Download

Starts downloads. Uses API Client only.

## Responsibilities

- Download action
- Options dialog
- Validation
- Start job

Never:
- show progress
- poll
- use SSE
- manage jobs

## Structure

```text
src/features/download/
├── DownloadDialog.tsx
├── DownloadButton.tsx
├── DownloadOptions.tsx
├── hooks.ts
├── types.ts
└── index.ts
```

## Flow

```text
Download
↓
Options
↓
download()
↓
job_id
↓
close
```

## Options

Display:

- output folder
- format
- quality

Folder defaults to user settings.

## Validation

Require:

- url
- output folder

Disable submit while loading.

## Hooks

Expose:

```ts
useDownload()
```

Uses TanStack Query.

Calls:

```ts
download(...)
```

Returns `job_id`.

No polling.

No SSE.

## Dialog

Open from Download button.

Close on:

- success
- cancel

## Errors

Display normalized `ApiError`.

## Compatibility

Depends on:

- Foundation
- API Client
- Layout
- Search

## Principles

Thin • Typed • Responsive • Accessible