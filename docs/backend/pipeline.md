# Pipeline Module

Orchestration layer. Coordinates existing modules for complete metadata enrichment workflow. Thin layer — no duplicate business logic.

## Responsibilities
Single entry point for metadata workflow. Reuses: `extractor.py`, `matcher.py`, `lyrics.py`, `writer.py`, `providers/*`, `downloader.py`. Never duplicates existing logic.

## Workflow
```
Local File → extractor.py → matcher.py → Providers → merge_missing_fields() → Optional Deezer Details → lyrics.py → writer.py → PipelineResult
```

## Steps
1. Read existing metadata from file (`extractor.py`)
2. Search via all enabled providers (`matcher.py` — never communicate with providers individually)
3. Rank candidates (existing confidence calculation)
4. Merge metadata (`merge_missing_fields()`)
5. Optional Deezer detail fetch for missing: track_number, disc_number, isrc, year
6. Fetch lyrics (`lyrics.py`)
7. Build final metadata object (title, artist, album, artwork, lyrics, genres, track info, identifiers)
8. Write metadata (`writer.py` — tags, cover art, lyrics)

## Public API
```python
class MetadataPipeline:
    async def analyze_file(...)
    async def enrich_file(...)
    async def write_metadata(...)
```

## PipelineResult
`success`, `source_file`, `metadata`, `matches`, `selected_match`, `lyrics`, `warnings`, `errors`, `elapsed_time`. Reusable by CLI, FastAPI, Desktop UI, Android, future clients.

## Non-Responsibilities
Must NOT: implement matching algorithms, provider-specific logic, communicate with providers directly, write tags manually, download media, contain CLI logic, print to stdout, request user input, depend on FastAPI/Tauri/UI.

## Error Handling
Provider failures don't stop pipeline (Apple unavailable, MusicBrainz timeout, Last.fm rate limit). Continue with remaining providers. Only unrecoverable errors stop execution.

## Logging
Python logging module. Never `print()` or `input()`.

## Progress Reporting
Support stages: reading file, searching metadata, ranking candidates, merging, fetching lyrics, writing. Callbacks not required first iteration but design must support easy addition.

## Cancellation
Architecture must allow future cancellation. Avoid designs making it difficult.

## Performance
No duplicate provider queries. Reuse search results. Avoid duplicate network requests. Reuse merged metadata.

## Compatibility
Creating pipeline must not change current behavior. Only moves orchestration from `test.py`. Metadata enrichment workflow functionally identical.

## test.py After Pipeline
Becomes lightweight dev tool: ask file → display candidates → select → call pipeline → display result. Business logic lives in pipeline.

## Future Integrations
Backend entry point for: FastAPI, Tauri, Android, Web, CLI. No client should orchestrate extractor/matcher/writer/lyrics directly.

## Stability
Future features integrate through pipeline, not bypassing it. Guarantees: single source of truth, consistent behavior, easier maintenance, simpler testing.

## Design
Not a business logic module, not a provider, not a downloader, not a writer. Only coordinates existing modules. Small, predictable, reusable, framework-independent, easy to test/extend.
