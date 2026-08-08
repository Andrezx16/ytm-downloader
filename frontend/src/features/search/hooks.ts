import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { search, getVideoInfo, download } from "@/api";
import { useLocalStorage } from "@/hooks";
import type { SearchRequest } from "@/api/search";
import type { DownloadRequest } from "@/api/download";
import type { ApiError } from "@/api/errors";

const HISTORY_KEY = "ytm-search-history";
const HISTORY_LIMIT = 5;

export function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<string[]>(HISTORY_KEY, []);

  const add = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setHistory((prev) => {
        const filtered = prev.filter((q) => q !== trimmed);
        return [trimmed, ...filtered].slice(0, HISTORY_LIMIT);
      });
    },
    [setHistory],
  );

  const remove = useCallback(
    (query: string) => {
      setHistory((prev) => prev.filter((q) => q !== query));
    },
    [setHistory],
  );

  const clear = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  return { history, add, remove, clear };
}

export function useSearch() {
  const searchMutation = useMutation({
    mutationFn: (params: SearchRequest) => search(params),
  });

  const videoInfoMutation = useMutation({
    mutationFn: (params: { url: string }) => getVideoInfo(params),
  });

  const downloadMutation = useMutation({
    mutationFn: (params: DownloadRequest) => download(params),
  });

  return {
    search: searchMutation.mutate,
    results: searchMutation.data,
    isLoading: searchMutation.isPending,
    error: searchMutation.error as ApiError | null,
    reset: searchMutation.reset,

    fetchVideoInfo: videoInfoMutation.mutate,
    videoInfoResult: videoInfoMutation.data,
    isFetchingVideoInfo: videoInfoMutation.isPending,
    videoInfoError: videoInfoMutation.error as ApiError | null,

    download: downloadMutation.mutate,
    downloadResult: downloadMutation.data,
    isDownloading: downloadMutation.isPending,
    downloadError: downloadMutation.error as ApiError | null,
  };
}
