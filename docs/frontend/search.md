# Frontend Search

Search UI. Uses API Client only.

## Responsibilities

- Search input
- Validation
- Results
- Loading
- Empty state
- Error state
- Start download

Never:
- perform HTTP outside `api/`
- manage jobs
- show download progress

## Structure

```text
src/features/search/
├── SearchPage.tsx
├── SearchBar.tsx
├── SearchResults.tsx
├── SearchCard.tsx
├── hooks.ts
├── types.ts
└── index.ts
```

## Flow

```text
Input
↓
search()
↓
Results
↓
download()
↓
job_id
```

## SearchBar

Owns:
- query
- submit
- validation

Trim input.

Ignore empty queries.

## Results

States:
- idle
- loading
- success
- empty
- error

Render one card per result.

## SearchCard

Display:
- thumbnail
- title
- artist
- duration

Actions:
- Download

No progress UI.

## Hooks

Expose:

```ts
useSearch()
```

Uses TanStack Query.

No HTTP outside API Client.

## Download

Uses:

```ts
download(...)
```

Returns `job_id`.

No polling.

No SSE.

## Errors

Display normalized `ApiError`.

## Compatibility

Depends on:
- Foundation
- API Client
- Layout

## Principles

Thin • Typed • Responsive • Accessible