import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Disc3,
  FileText,
  FileX,
  Loader2,
  SkipForward,
  Zap,
} from "lucide-react";
import { CoverPicker } from "./CoverPicker";
import { useImageDimensions } from "./useImageDimensions";
import type { MetadataFields } from "./types";
import type { MatchCandidate } from "@/api/pipeline";
import type { ApiError } from "@/api/errors";

interface MetadataFormProps {
  matches: MatchCandidate[];
  loadingProviders?: Set<string>;
  selectedIndex: number | null;
  lyricsFound: boolean | null;
  fields: MetadataFields;
  onFieldsChange: (fields: MetadataFields) => void;
  onSelectCandidate: (index: number) => void;
  onSelectNone: () => void;
  onRescan: () => void;
  isManualEdit: boolean;
  onWriteAndNext: () => void;
  onSkip: () => void;
  isSelecting: boolean;
  selectError: ApiError | null;
  isWriting: boolean;
  writeError: ApiError | null;
  disabled?: boolean;
  queueIndex: number;
  queueTotal: number;
  isCurrentLoading: boolean;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    deezer: "Deezer",
    apple: "Apple Music",
    musicbrainz: "MusicBrainz",
    lastfm: "Last.fm",
    spotify: "Spotify",
    ytmusic: "YouTube Music",
  };
  return labels[source] ?? source;
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const totalSec = Math.round(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function CandidateCard({
  match,
  isExpanded,
  onToggleExpand,
  isSelected,
  isBest,
  isSelectingThis,
  isSelectingOther,
  onSelect,
}: {
  match: MatchCandidate;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelected: boolean;
  isBest: boolean;
  isSelectingThis: boolean;
  isSelectingOther: boolean;
  onSelect: () => void;
}) {
  const disabled = isSelectingOther;
  const coverDims = useImageDimensions(match.cover_url);

  return (
    <div
      className={`rounded-md border transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-accent/50"
      } ${disabled && !isSelectingThis ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3 p-3">
        {match.cover_url ? (
          <div className="relative shrink-0">
            <img
              src={match.cover_url}
              alt=""
              className="size-10 rounded object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {coverDims && (
              <span className="absolute -bottom-1 -right-1 rounded bg-foreground/80 px-1 py-px text-[9px] leading-none text-background">
                {coverDims.w}x{coverDims.h}
              </span>
            )}
          </div>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
            <Disc3 className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{match.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {match.artist}
            {match.album ? ` · ${match.album}` : ""}
            {match.year ? ` · ${match.year}` : ""}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {sourceLabel(match.source)}
        </span>
        {match.confidence != null && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {(match.confidence * 100).toFixed(0)}%
          </span>
        )}
        {isBest && !isSelected && (
          <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Zap className="size-2.5" aria-hidden="true" />
            Best
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
        >
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled && !isSelectingThis) onSelect();
          }}
          disabled={disabled || isSelectingThis}
          className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isSelectingThis ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            "Select"
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {match.album_artist && (
              <span>
                <span className="font-medium text-foreground">Album artist: </span>
                {match.album_artist}
              </span>
            )}
            {match.genre && (
              <span>
                <span className="font-medium text-foreground">Genre: </span>
                {match.genre}
              </span>
            )}
            {match.track_number != null && (
              <span>
                <span className="font-medium text-foreground">Track: </span>
                {match.track_number}
              </span>
            )}
            {match.disc_number != null && (
              <span>
                <span className="font-medium text-foreground">Disc: </span>
                {match.disc_number}
              </span>
            )}
            {match.duration_ms > 0 && (
              <span>
                <span className="font-medium text-foreground">Duration: </span>
                {formatDuration(match.duration_ms)}
              </span>
            )}
            {match.isrc && (
              <span>
                <span className="font-medium text-foreground">ISRC: </span>
                {match.isrc}
              </span>
            )}
            {match.composer && (
              <span>
                <span className="font-medium text-foreground">Composer: </span>
                {match.composer}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fieldInput(
  key: keyof MetadataFields,
  label: string,
  fields: MetadataFields,
  onChange: (fields: MetadataFields) => void,
  disabled: boolean,
  opts?: { placeholder?: string; multiline?: boolean },
) {
  const update = (value: string) => onChange({ ...fields, [key]: value });

  if (opts?.multiline) {
    return (
      <div className="flex flex-col gap-1.5" key={key}>
        <label htmlFor={`meta-${key}`} className="text-sm font-medium">
          {label}
        </label>
        <textarea
          id={`meta-${key}`}
          value={fields[key]}
          onChange={(e) => update(e.target.value)}
          placeholder={opts.placeholder}
          rows={3}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5" key={key}>
      <label htmlFor={`meta-${key}`} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={`meta-${key}`}
        type="text"
        value={fields[key]}
        onChange={(e) => update(e.target.value)}
        placeholder={opts?.placeholder}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={disabled}
      />
    </div>
  );
}

export function MetadataForm({
  matches,
  loadingProviders,
  selectedIndex,
  lyricsFound,
  fields,
  onFieldsChange,
  onSelectCandidate,
  onSelectNone,
  onRescan,
  isManualEdit,
  onWriteAndNext,
  onSkip,
  isSelecting,
  selectError,
  isWriting,
  writeError,
  disabled = false,
  queueIndex,
  queueTotal,
  isCurrentLoading,
}: MetadataFormProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const isLoading = loadingProviders && loadingProviders.size > 0;
  const providersLeft = loadingProviders ? Array.from(loadingProviders) : [];

  // Progress bar
  const progress = queueTotal > 0 ? ((queueIndex + 1) / queueTotal) * 100 : 0;

  // Best candidate: confidence > 0.80 + provider with highest typical resolution
  const PROVIDER_RES_PRIORITY: Record<string, number> = {
    deezer: 100,
    apple: 80,
    spotify: 70,
    ytmusic: 60,
    lastfm: 50,
    musicbrainz: 0,
  };
  const bestIndex = useMemo(() => {
    if (selectedIndex !== null || matches.length === 0) return null;
    const scored = matches
      .map((m, i) => ({
        i,
        conf: m.confidence ?? 0,
        res: PROVIDER_RES_PRIORITY[m.source] ?? 30,
        hasCover: !!m.cover_url,
      }))
      .filter((c) => c.conf > 0.8 && c.hasCover);
    if (scored.length === 0) return null;
    return scored.reduce((best, c) =>
      c.conf > best.conf || (c.conf === best.conf && c.res > best.res) ? c : best,
    ).i;
  }, [matches, selectedIndex]);

  // Analyzing state — no matches yet, still loading
  if (isCurrentLoading && matches.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Song {queueIndex + 1} of {queueTotal}
          </p>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">
            Searching {providersLeft.map(sourceLabel).join(", ")}...
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <SkipForward className="size-4" />
          Skip
        </button>
      </div>
    );
  }

  // No matches found and not loading (and not in manual edit mode)
  if (matches.length === 0 && !isLoading && selectedIndex === null) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Song {queueIndex + 1} of {queueTotal}
          </p>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-sm text-muted-foreground">No candidates found</p>
        </div>
        <button
          type="button"
          onClick={onSelectNone}
          className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          None — edit manually
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <SkipForward className="size-4" />
          Skip
        </button>
      </div>
    );
  }

  // Has matches — show candidate list (analyze step)
  if (selectedIndex === null) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            Select a candidate
            {isLoading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({providersLeft.map(sourceLabel).join(", ")} loading...)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Song {queueIndex + 1} of {queueTotal}
          </p>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex flex-col gap-1">
          {matches.map((match, i) => (
            <CandidateCard
              key={`${match.source}-${i}`}
              match={match}
              isExpanded={expandedIndex === i}
              onToggleExpand={() =>
                setExpandedIndex(expandedIndex === i ? null : i)
              }
              isSelected={selectedIndex === i}
              isBest={bestIndex === i}
              isSelectingThis={isSelecting && selectedIndex === i}
              isSelectingOther={isSelecting && selectedIndex !== i}
              onSelect={() => onSelectCandidate(i)}
            />
          ))}
        </div>
        {isSelecting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Enriching with merge + Deezer details + lyrics...
          </div>
        )}
        {selectError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {selectError.message}
          </div>
        )}
        <button
          type="button"
          onClick={onSelectNone}
          disabled={isSelecting}
          className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          None — edit manually
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <SkipForward className="size-4" />
          Skip
        </button>
      </div>
    );
  }

  // Edit step — candidate selected, show editable form
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onWriteAndNext();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Edit metadata</p>
        <p className="text-xs text-muted-foreground">
          Song {queueIndex + 1} of {queueTotal}
        </p>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {lyricsFound !== null && (
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
            lyricsFound
              ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
              : "border border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400"
          }`}
        >
          {lyricsFound ? (
            <FileText className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <FileX className="size-4 shrink-0" aria-hidden="true" />
          )}
          {lyricsFound ? "Lyrics found and loaded" : "Lyrics not found for this track"}
        </div>
      )}

      <CoverPicker
        value={fields.cover_url}
        onChange={(cover_url) => onFieldsChange({ ...fields, cover_url })}
        disabled={disabled}
        alternatives={matches.filter(
          (m) => m.cover_url && m.cover_url !== fields.cover_url,
        )}
        onAlternativeSelect={(cover_url) => onFieldsChange({ ...fields, cover_url })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fieldInput("title", "Title", fields, onFieldsChange, disabled)}
        {fieldInput("artist", "Artist", fields, onFieldsChange, disabled)}
        {fieldInput("album", "Album", fields, onFieldsChange, disabled)}
        {fieldInput("album_artist", "Album artist", fields, onFieldsChange, disabled)}
        {fieldInput("genre", "Genre", fields, onFieldsChange, disabled)}
        {fieldInput("year", "Year", fields, onFieldsChange, disabled, { placeholder: "2024" })}
        {fieldInput("track", "Track", fields, onFieldsChange, disabled, { placeholder: "1" })}
        {fieldInput("disc", "Disc", fields, onFieldsChange, disabled, { placeholder: "1" })}
      </div>

      {fieldInput("lyrics", "Lyrics", fields, onFieldsChange, disabled, { multiline: true })}

      <div className="flex items-center gap-3">
        {isManualEdit && (
          <button
            type="button"
            onClick={onRescan}
            disabled={disabled || isWriting}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <Zap className="size-4" />
            Re-scan
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || isWriting}
          className="h-10 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isWriting ? "Writing..." : queueIndex + 1 < queueTotal ? "Write & Next" : "Write metadata"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={isWriting}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <SkipForward className="size-4" />
          Skip
        </button>
      </div>

      {isWriting === false && writeError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {writeError?.message ?? "Failed to write metadata"}
        </div>
      )}
    </form>
  );
}
