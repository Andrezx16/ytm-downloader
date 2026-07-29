import { useState, useCallback } from "react";
import { trackJob } from "@/features/jobs";
import type { DownloadOptions } from "@/features/download/types";
import { usePlaylist, usePlaylistDownload, useTrackSelection, usePlaylistHistory } from "./hooks";
import { PlaylistUrlForm } from "./PlaylistUrlForm";
import { PlaylistHeader } from "./PlaylistHeader";
import { PlaylistTrackList } from "./PlaylistTrackList";
import { PlaylistBatchBar } from "./PlaylistBatchBar";

export function PlaylistPage() {
  const [url, setUrl] = useState<string | null>(null);
  const { playlist, isLoading, error } = usePlaylist(url);
  const { download, isLoading: isDownloading } = usePlaylistDownload();
  const playlistHistory = usePlaylistHistory();

  const tracks = playlist?.entries ?? [];
  const {
    selected,
    selectedPositions,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    selectRange,
  } = useTrackSelection(tracks);

  const handleLoad = useCallback((newUrl: string) => {
    setUrl(newUrl);
    playlistHistory.add(newUrl);
  }, [playlistHistory]);

  const handleHistorySelect = useCallback((historyUrl: string) => {
    setUrl(historyUrl);
  }, []);

  const handleDownload = useCallback(
    (options: DownloadOptions) => {
      if (!url) return;
      download(
        {
          url,
          selected: selectedPositions,
          ...options,
        },
        {
          onSuccess: (data) => {
            trackJob(data.id, playlist?.title ?? "Playlist download");
          },
        },
      );
    },
    [url, selectedPositions, download, playlist?.title],
  );

  if (!url || (!isLoading && !playlist && !error)) {
    return (
      <PlaylistUrlForm
        onSubmit={handleLoad}
        isLoading={false}
        history={playlistHistory.history}
        onHistorySelect={handleHistorySelect}
        onHistoryRemove={playlistHistory.remove}
        onHistoryClear={playlistHistory.clear}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <p className="text-sm text-muted-foreground">Loading playlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-sm text-destructive">
          Failed to load playlist. Check the URL and try again.
        </p>
        <button
          onClick={() => setUrl(null)}
          className="rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          Try another URL
        </button>
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="flex flex-col gap-6">
      <PlaylistHeader playlist={playlist} />
      <PlaylistBatchBar
        selectedCount={selectedPositions.length}
        onDownload={handleDownload}
        isLoading={isDownloading}
      />
      <PlaylistTrackList
        tracks={tracks}
        selected={selected}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onSelectRange={selectRange}
        disabled={isDownloading}
      />
    </div>
  );
}
