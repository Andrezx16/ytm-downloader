import type { PlaylistData } from "./types";
import { formatDuration } from "./hooks";

interface PlaylistHeaderProps {
  playlist: PlaylistData;
}

export function PlaylistHeader({ playlist }: PlaylistHeaderProps) {
  return (
    <div className="flex items-start gap-4">
      {playlist.thumbnail_url && (
        <img
          src={playlist.thumbnail_url}
          alt=""
          className="size-24 rounded-lg object-cover"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold truncate">{playlist.title}</h1>
        {playlist.uploader && (
          <p className="text-sm text-muted-foreground truncate">
            {playlist.uploader}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{playlist.total_tracks} tracks</span>
          <span>{formatDuration(playlist.total_duration)}</span>
        </div>
      </div>
    </div>
  );
}
