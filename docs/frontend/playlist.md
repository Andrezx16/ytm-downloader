# Frontend Playlist

Batch playlist downloads.

## Responsibilities

- Parse playlist URL
- Show playlist
- Select tracks
- Download selected

Never:
- manage jobs
- write metadata

## Structure

```text
src/features/playlist/
├── PlaylistPage.tsx
├── PlaylistForm.tsx
├── PlaylistInfo.tsx
├── PlaylistTrackList.tsx
├── PlaylistTrack.tsx
├── PlaylistActions.tsx
├── hooks.ts
├── types.ts
└── index.ts
```

## Flow

```text
URL
↓
getPlaylist()
↓
playlist
↓
select tracks
↓
downloadPlaylist()
↓
job_id
```

## Hooks

```ts
usePlaylist()
usePlaylistDownload()
```

Use API only.

## Display

- title
- author
- thumbnail
- track count
- duration
- tracks

Each track:

- thumbnail
- title
- artist
- duration
- checkbox

## Actions

- Select all
- Clear
- Invert
- Download selected

## Validation

- valid URL
- ≥1 selected

## Errors

Display normalized `ApiError`.

## Compatibility

Depends on:

- Foundation
- API Client
- Layout
- Download
- Jobs

## Principles

Thin • Typed • Accessible