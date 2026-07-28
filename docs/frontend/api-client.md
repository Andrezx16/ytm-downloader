# Frontend API Client

HTTP integration layer. No UI, business logic or React dependencies.

## Structure

```text
src/api/
├── client.ts
├── search.ts
├── download.ts
├── playlist.ts
├── pipeline.ts
├── jobs.ts
├── errors.ts
└── index.ts
```

## Client

`client.ts` owns:
- base URL (`VITE_API_URL`)
- JSON defaults
- timeout
- AbortSignal
- shared request helper

No endpoint logic.

## Modules

One backend domain per file.

```text
search.ts      → /search
download.ts    → /download
playlist.ts    → /playlist*
pipeline.ts    → /pipeline*
jobs.ts        → /jobs*
```

No cross-module imports.

## Public API

Expose typed async functions only.

Examples:

```ts
search()
download()
getPlaylist()
downloadPlaylist()
analyze()
enrich()
write()
getJob()
cancelJob()
subscribeJob()
```

Components never build URLs or perform HTTP requests.

## Types

Each module owns its Request/Response types.

Shared types belong in `types/`.

## Errors

Normalize backend errors.

```ts
ApiError {
    status
    message
    details?
}
```

Never expose raw HTTP library errors.

## TanStack Query

API modules expose functions only.

React hooks belong to feature modules.

## Jobs

Support:
- status
- cancel
- SSE subscription

No polling.

## Compatibility

Depends only on backend HTTP endpoints.

## Principles

Thin • Typed • Modular • Testable