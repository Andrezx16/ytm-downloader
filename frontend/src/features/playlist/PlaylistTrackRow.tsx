import type { PlaylistTrack } from "./types";
import { formatDuration } from "./hooks";

interface PlaylistTrackRowProps {
  track: PlaylistTrack;
  selected: boolean;
  onToggle: (position: number) => void;
  disabled?: boolean;
}

export function PlaylistTrackRow({
  track,
  selected,
  onToggle,
  disabled = false,
}: PlaylistTrackRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(track.position)}
        disabled={disabled}
        className="size-4 shrink-0 rounded border-input"
        aria-label={`Select track ${track.position}`}
      />
      <img
        src={track.thumbnail_url}
        alt=""
        className="size-10 rounded object-cover"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist || track.uploader}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">
        {formatDuration(track.duration_seconds)}
      </span>
    </div>
  );
}
