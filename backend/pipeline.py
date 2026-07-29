from __future__ import annotations

import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence, cast

from extractor import read_file_info
from lyrics import get_lyrics
from matcher import FileInfo, find_matches, find_matches_stream, merge_missing_fields
from providers.apple import AppleMusicProvider
from providers.base import MatchCandidate, MusicProvider
from providers.deezer import DeezerProvider
from providers.lastfm import LastFmProvider
from providers.musicbrainz import MusicBrainzProvider
from writer import FinalMetadata, write_metadata as write_audio_metadata

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class MetadataAnalysis:
    source_file: str
    file_info: FileInfo
    matches: list[MatchCandidate]
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    elapsed_time: float = 0.0


@dataclass(slots=True)
class SelectResult:
    match: MatchCandidate
    lyrics: str | None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass(slots=True)
class PipelineResult:
    success: bool
    source_file: str
    file_info: FileInfo
    metadata: FinalMetadata | None
    matches: list[MatchCandidate]
    selected_match: MatchCandidate | None
    lyrics: str | None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    elapsed_time: float = 0.0
    wrote_metadata: bool = False


class MetadataPipeline:
    def __init__(self, providers: Sequence[MusicProvider] | None = None) -> None:
        self._providers = list(
            providers
            if providers is not None
            else [
                DeezerProvider(),
                AppleMusicProvider(),
                MusicBrainzProvider(),
                LastFmProvider(),
            ]
        )

    @property
    def providers(self) -> Sequence[MusicProvider]:
        return tuple(self._providers)

    async def __aenter__(self) -> "MetadataPipeline":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        for provider in self._providers:
            close = getattr(provider, "aclose", None)
            if close is not None:
                try:
                    await close()
                except Exception:
                    logger.exception("Failed to close provider %s", provider.name)

    async def analyze_file(self, path: str | Path) -> MetadataAnalysis:
        started = time.perf_counter()
        file_path = Path(path)
        file_info = read_file_info(file_path)

        matches = await find_matches(file_info, self._providers)
        warnings: list[str] = []
        errors: list[str] = []

        if not matches:
            warnings.append("No metadata candidates found")

        elapsed_time = time.perf_counter() - started
        return MetadataAnalysis(
            source_file=str(file_path),
            file_info=file_info,
            matches=matches,
            warnings=warnings,
            errors=errors,
            elapsed_time=elapsed_time,
        )

    async def analyze_stream(self, path: str | Path) -> AsyncGenerator[dict, None]:
        """Stream per-provider results, then final scored list."""
        file_path = Path(path)
        file_info = read_file_info(file_path)

        async for event in find_matches_stream(file_info, self._providers):
            if event["event"] == "complete":
                matches = event["all_matches"]
                warnings: list[str] = []
                errors: list[str] = []
                if not matches:
                    warnings.append("No metadata candidates found")
                yield {
                    "event": "complete",
                    "source_file": str(file_path),
                    "file_info": {
                        "title": file_info.title,
                        "artist": file_info.artist,
                        "album": file_info.album,
                        "duration_ms": file_info.duration_ms,
                    },
                    "all_matches": matches,
                    "warnings": warnings,
                    "errors": errors,
                    "elapsed_time": event["elapsed_time"],
                }
            else:
                yield event

    async def select_match(
        self,
        path: str | Path,
        matches: list[MatchCandidate],
        selected_index: int,
    ) -> SelectResult:
        warnings: list[str] = []
        errors: list[str] = []

        if not matches or selected_index < 0 or selected_index >= len(matches):
            errors.append("Invalid candidate selection")
            return SelectResult(match={}, lyrics=None, warnings=warnings, errors=errors)

        selected = matches[selected_index]
        merged = merge_missing_fields(selected, matches)
        merged, deezer_warning = await self._apply_deezer_details(merged, matches)
        if deezer_warning is not None:
            warnings.append(deezer_warning)

        lyrics: str | None = None
        try:
            lyrics = await get_lyrics(merged["title"], merged["artist"])
        except Exception:
            logger.exception("Lyrics fetch failed during select")
        if lyrics is None:
            warnings.append("Lyrics not found")

        return SelectResult(match=merged, lyrics=lyrics, warnings=warnings, errors=errors)

    async def enrich_file(
        self,
        path: str | Path,
        *,
        selected_index: int | None = None,
        analysis: MetadataAnalysis | None = None,
        write: bool = False,
    ) -> PipelineResult:
        analysis = analysis or await self.analyze_file(path)
        started = time.perf_counter()

        warnings = list(analysis.warnings)
        errors = list(analysis.errors)

        selected_match = self._select_match(analysis.matches, selected_index)
        if selected_match is None:
            errors.append("No candidate selected")
            return PipelineResult(
                success=False,
                source_file=analysis.source_file,
                file_info=analysis.file_info,
                metadata=None,
                matches=analysis.matches,
                selected_match=None,
                lyrics=None,
                warnings=warnings,
                errors=errors,
                elapsed_time=analysis.elapsed_time + (time.perf_counter() - started),
            )

        merged = merge_missing_fields(selected_match, analysis.matches)
        merged, deezer_warning = await self._apply_deezer_details(merged, analysis.matches)
        if deezer_warning is not None:
            warnings.append(deezer_warning)

        lyrics = await get_lyrics(merged["title"], merged["artist"])
        if lyrics is None:
            warnings.append("Lyrics not found")

        metadata = cast(
            FinalMetadata,
            {
                "title": merged["title"],
                "artist": merged["artist"],
                "album": merged["album"],
                "album_artist": merged["album_artist"],
                "year": merged["year"],
                "genre": merged["genre"],
                "track_number": merged["track_number"],
                "disc_number": merged["disc_number"],
                "isrc": merged["isrc"],
                "composer": merged["composer"],
                "cover_url": merged["cover_url"],
                "lyrics": lyrics,
            },
        )

        wrote_metadata = False
        if write:
            await write_audio_metadata(analysis.source_file, metadata)
            wrote_metadata = True

        elapsed_time = analysis.elapsed_time + (time.perf_counter() - started)
        return PipelineResult(
            success=True,
            source_file=analysis.source_file,
            file_info=analysis.file_info,
            metadata=metadata,
            matches=analysis.matches,
            selected_match=cast(MatchCandidate, merged),
            lyrics=lyrics,
            warnings=warnings,
            errors=errors,
            elapsed_time=elapsed_time,
            wrote_metadata=wrote_metadata,
        )

    async def write_metadata(self, path: str | Path, metadata: FinalMetadata) -> None:
        await write_audio_metadata(path, metadata)

    def _select_match(
        self,
        matches: Sequence[MatchCandidate],
        selected_index: int | None,
    ) -> MatchCandidate | None:
        if not matches:
            return None
        if selected_index is None:
            return matches[0]
        if selected_index < 0 or selected_index >= len(matches):
            raise IndexError(f"Selected candidate out of range: {selected_index}")
        return matches[selected_index]

    async def _apply_deezer_details(
        self,
        selected: MatchCandidate,
        matches: Sequence[MatchCandidate],
    ) -> tuple[MatchCandidate, str | None]:
        still_missing = any(selected.get(field) is None for field in ("track_number", "disc_number", "isrc", "year"))
        also_missing = any(
            selected.get(field) is None or selected.get(field) == ""
            for field in ("album", "album_artist")
        )
        deezer_candidate = next((match for match in matches if match["source"] == "deezer"), None)
        if not still_missing and not also_missing:
            return selected, None
        if not deezer_candidate or not deezer_candidate.get("source_id"):
            return selected, None

        deezer_provider = next(
            (provider for provider in self._providers if provider.name == "deezer" and hasattr(provider, "get_full_details")),
            None,
        )
        if deezer_provider is None:
            return selected, "Deezer details unavailable"

        try:
            source_id = cast(str, deezer_candidate["source_id"])
            details = await cast(Any, deezer_provider).get_full_details(source_id)
        except Exception:
            logger.exception("Deezer full details lookup failed")
            return selected, "Deezer details unavailable"

        if not details:
            return selected, "Deezer details unavailable"

        enriched = cast(MatchCandidate, dict(selected))
        for key, value in details.items():
            if value is not None and value != "":
                enriched[key] = value  # type: ignore[literal-required]

        return enriched, None


__all__ = ["MetadataAnalysis", "MetadataPipeline", "PipelineResult", "SelectResult"]
