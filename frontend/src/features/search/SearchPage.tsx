import { useCallback, useMemo, useState } from "react";
import { Page } from "@/components/layout/Page";
import { DownloadDialog } from "@/features/download";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import { useSearch, useSearchHistory } from "./hooks";
import { isYouTubeUrl } from "./utils";
import type { SearchResult } from "./types";

export function SearchPage() {
  const {
    search,
    results: textResults,
    isLoading: isTextLoading,
    error: textError,
    reset: resetText,
    fetchVideoInfo,
    videoInfoResult,
    isFetchingVideoInfo,
    videoInfoError,
  } = useSearch();

  const { history, add, remove, clear } = useSearchHistory();
  const [downloadTarget, setDownloadTarget] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<"text" | "url">("text");

  const isLoading = searchMode === "url" ? isFetchingVideoInfo : isTextLoading;
  const error = searchMode === "url" ? videoInfoError : textError;
  const results = searchMode === "url"
    ? (videoInfoResult ? [videoInfoResult] : undefined)
    : textResults;

  const state = useMemo(() => {
    if (isLoading) return "loading";
    if (error) return "error";
    if (results && results.length === 0) return "empty";
    if (results && results.length > 0) return "success";
    return "idle";
  }, [isLoading, error, results]);

  const handleSearch = useCallback(
    (query: string) => {
      add(query);
      if (isYouTubeUrl(query)) {
        resetText();
        setSearchMode("url");
        fetchVideoInfo({ url: query });
      } else {
        setSearchMode("text");
        search({ query });
      }
    },
    [add, search, resetText, fetchVideoInfo],
  );

  const handleDownload = useCallback(
    (result: SearchResult) => {
      setDownloadTarget(result);
    },
    [],
  );

  const handleCloseDialog = useCallback(() => {
    setDownloadTarget(null);
  }, []);

  return (
    <Page>
      <div className="flex flex-col gap-6">
        <SearchBar
          onSearch={handleSearch}
          isLoading={isLoading}
          history={history}
          onHistorySelect={handleSearch}
          onHistoryRemove={remove}
          onHistoryClear={clear}
        />
        <SearchResults
          state={state}
          results={results}
          error={error}
          onDownload={handleDownload}
        />
      </div>

      {downloadTarget && (
        <DownloadDialog
          url={downloadTarget.url}
          title={downloadTarget.title}
          open={true}
          onClose={handleCloseDialog}
        />
      )}
    </Page>
  );
}
