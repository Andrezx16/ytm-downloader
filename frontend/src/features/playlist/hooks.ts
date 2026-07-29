import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getPlaylist, downloadPlaylist } from "@/api";
import { useLocalStorage } from "@/hooks";
import type { PlaylistDownloadRequest } from "@/api/playlist";
import type { PlaylistTrack } from "./types";

const PLAYLIST_HISTORY_KEY = "ytm-playlist-history";
const PLAYLIST_HISTORY_LIMIT = 10;

export function usePlaylistHistory() {
  const [history, setHistory] = useLocalStorage<string[]>(PLAYLIST_HISTORY_KEY, []);

  const add = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      setHistory((prev) => {
        const filtered = prev.filter((u) => u !== trimmed);
        return [trimmed, ...filtered].slice(0, PLAYLIST_HISTORY_LIMIT);
      });
    },
    [setHistory],
  );

  const remove = useCallback(
    (url: string) => {
      setHistory((prev) => prev.filter((u) => u !== url));
    },
    [setHistory],
  );

  const clear = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  return { history, add, remove, clear };
}

export function usePlaylist(url: string | null) {
  const query = useQuery({
    queryKey: ["playlist", url],
    queryFn: () => getPlaylist({ url: url! }),
    enabled: !!url,
    retry: false,
  });

  return {
    playlist: query.data ?? null,
    isLoading: query.isPending,
    error: query.error,
  };
}

export function usePlaylistDownload() {
  const mutation = useMutation({
    mutationFn: (params: PlaylistDownloadRequest) => downloadPlaylist(params),
  });

  return {
    download: mutation.mutate,
    result: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  };
}

export function useTrackSelection(tracks: PlaylistTrack[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allSelected = tracks.length > 0 && selected.size === tracks.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggle = useCallback((position: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(position)) {
        next.delete(position);
      } else {
        next.add(position);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === tracks.length) {
        return new Set();
      }
      return new Set(tracks.map((t) => t.position));
    });
  }, [tracks]);

  const selectAll = useCallback(() => {
    setSelected(new Set(tracks.map((t) => t.position)));
  }, [tracks]);

  const selectRange = useCallback(
    (start: number, end: number) => {
      const min = Math.max(1, Math.min(start, end));
      const max = Math.min(tracks.length, Math.max(start, end));
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = min; i <= max; i++) {
          next.add(i);
        }
        return next;
      });
    },
    [tracks.length],
  );

  const selectedPositions = useMemo(() => Array.from(selected).sort((a, b) => a - b), [selected]);

  return {
    selected,
    selectedPositions,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    selectAll,
    selectRange,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${secs}s`;
}
