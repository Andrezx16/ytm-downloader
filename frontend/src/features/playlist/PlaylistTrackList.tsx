import { useState } from "react";
import type { PlaylistTrack } from "./types";
import { PlaylistTrackRow } from "./PlaylistTrackRow";

interface PlaylistTrackListProps {
  tracks: PlaylistTrack[];
  selected: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggle: (position: number) => void;
  onToggleAll: () => void;
  onSelectRange: (start: number, end: number) => void;
  disabled?: boolean;
}

export function PlaylistTrackList({
  tracks,
  selected,
  allSelected,
  someSelected,
  onToggle,
  onToggleAll,
  onSelectRange,
  disabled = false,
}: PlaylistTrackListProps) {
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const handleSelectRange = () => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    if (isNaN(start) || isNaN(end)) return;
    const clampedStart = Math.max(1, Math.min(start, tracks.length));
    const clampedEnd = Math.max(1, Math.min(end, tracks.length));
    onSelectRange(clampedStart, clampedEnd);
    setRangeStart("");
    setRangeEnd("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 px-1">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={onToggleAll}
          disabled={disabled}
          className="size-4 shrink-0 rounded border-input"
          aria-label="Select all tracks"
        />
        <span className="text-xs text-muted-foreground">
          {selected.size} of {tracks.length} selected
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="number"
            min={1}
            max={tracks.length}
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            placeholder="Start"
            disabled={disabled}
            className="h-7 w-16 rounded border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <input
            type="number"
            min={1}
            max={tracks.length}
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            placeholder="End"
            disabled={disabled}
            className="h-7 w-16 rounded border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSelectRange}
            disabled={disabled || !rangeStart || !rangeEnd}
            className="h-7 rounded-md border border-input px-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            Select
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {tracks.map((track) => (
          <PlaylistTrackRow
            key={track.video_id}
            track={track}
            selected={selected.has(track.position)}
            onToggle={onToggle}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
