# pipeline.py

## Purpose

`pipeline.py` is the orchestration layer of the backend.

Its responsibility is to coordinate the existing modules and execute the complete metadata enrichment workflow.

It must **not** contain business logic that already exists elsewhere.

The pipeline should remain a thin orchestration layer.

---

# Responsibilities

The pipeline is the single entry point for the metadata workflow.

It coordinates the existing modules while keeping them independent.

It must reuse:

- extractor.py
- matcher.py
- lyrics.py
- writer.py
- providers/*
- downloader.py

It must never duplicate existing business logic.

---

# Responsibilities of the Pipeline

The pipeline should:

- Read metadata from a local file.
- Query all enabled providers.
- Rank metadata candidates.
- Merge missing metadata fields.
- Retrieve additional metadata when necessary.
- Fetch lyrics.
- Build the final metadata object.
- Write metadata to the file when requested.
- Return structured results to the caller.

---

# Non-Responsibilities

The pipeline must NOT:

- implement metadata matching algorithms
- implement provider-specific logic
- communicate directly with providers
- write tags manually
- download media manually
- contain CLI logic
- print to stdout
- request user input
- depend on FastAPI
- depend on Tauri
- depend on any UI framework

User interaction belongs to the caller.

---

# Architecture

The expected workflow is:

```
Local File

↓

extractor.py

↓

matcher.py

↓

Enabled Providers

↓

merge_missing_fields()

↓

Optional Deezer Full Details

↓

lyrics.py

↓

writer.py

↓

PipelineResult
```

The pipeline coordinates this flow but does not replace any module.

---

# Metadata Enrichment Workflow

## Step 1

Read existing metadata from the local file.

Reuse `extractor.py`.

---

## Step 2

Search metadata using all enabled providers.

This must be performed through `matcher.py`.

The pipeline must never communicate with providers individually.

---

## Step 3

Rank all candidates.

Reuse the existing confidence calculation.

Do not implement another ranking algorithm.

---

## Step 4

Merge metadata.

Use the existing `merge_missing_fields()` implementation.

The goal is to produce the most complete metadata object possible.

---

## Step 5

Optional Deezer Details

If important fields are still missing, such as:

- track number
- disc number
- ISRC
- release year

the pipeline may request additional metadata through the existing Deezer implementation.

This step is optional.

---

## Step 6

Fetch lyrics.

Reuse `lyrics.py`.

Do not implement another lyrics provider inside the pipeline.

---

## Step 7

Build Final Metadata

Create a single metadata object containing:

- title
- artists
- album
- artwork
- lyrics
- genres
- track information
- identifiers

This object should be ready to be written to disk.

---

## Step 8

Write Metadata

When requested by the caller,

reuse `writer.py` to write:

- tags
- cover artwork
- lyrics

The pipeline must never write tags directly.

---

# Public API

The implementation is free to choose the final names.

Conceptually, the pipeline should expose methods similar to:

```python
class MetadataPipeline:

    async def enrich_file(...)

    async def write_metadata(...)

    async def download_and_enrich(...)
```

Method names may differ if a better design is chosen.

---

# PipelineResult

The pipeline should return structured Python objects.

Suggested fields:

```python
PipelineResult

success

source_file

metadata

matches

selected_match

lyrics

warnings

errors

elapsed_time
```

Exact field names are implementation details.

The important requirement is that the result is reusable by:

- CLI
- FastAPI
- Desktop UI
- Android
- Future clients

---

# Error Handling

Provider failures should not stop the pipeline.

Examples:

- Apple unavailable
- MusicBrainz timeout
- Last.fm rate limit

The pipeline should continue using the remaining providers.

Only unrecoverable errors should stop execution.

---

# Logging

The pipeline should use Python's logging module.

Never use:

- print()
- input()

Logging should remain suitable for development and production.

---

# Progress Reporting

The architecture should support progress reporting.

Typical stages include:

- Reading file
- Searching metadata
- Ranking candidates
- Merging metadata
- Fetching lyrics
- Writing metadata

Progress callbacks are not required in the first implementation.

However, the design should make them easy to add later.

---

# Cancellation

The architecture should allow future cancellation support.

Cancellation is not required now.

Avoid designs that make cancellation difficult.

---

# Performance

The pipeline should avoid unnecessary work.

Requirements:

- Do not query providers twice.
- Reuse existing search results.
- Avoid duplicate network requests.
- Reuse merged metadata whenever possible.

---

# Compatibility

Creating the pipeline must not change the current behavior.

The goal is only to move orchestration logic out of `test.py`.

The metadata enrichment workflow should remain functionally identical.

---

# test.py

After implementing `pipeline.py`:

`test.py` should become a lightweight development tool.

It should only:

- ask for a file
- display metadata candidates
- allow candidate selection
- call the pipeline
- display the final result

Business logic should live exclusively inside the pipeline.

---

# Future Integrations

This module will become the backend entry point for:

- FastAPI
- Tauri
- Android
- Web
- CLI

No client should directly orchestrate:

- extractor.py
- matcher.py
- writer.py
- lyrics.py

All orchestration should happen inside the pipeline.

---

# Stability Principle

Once `pipeline.py` exists,

future features should integrate through the pipeline instead of bypassing it.

This guarantees:

- a single source of truth
- consistent behavior across all clients
- easier maintenance
- simpler testing

---

# Design Philosophy

The pipeline is **not** a business logic module.

The pipeline is **not** a provider.

The pipeline is **not** a downloader.

The pipeline is **not** a writer.

The pipeline is only responsible for coordinating existing modules.

It should remain:

- small
- predictable
- reusable
- framework-independent
- easy to test
- easy to extend

Whenever possible, specialized logic should remain inside the module that already owns that responsibility.