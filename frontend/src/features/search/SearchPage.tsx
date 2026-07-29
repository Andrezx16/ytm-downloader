import { useCallback, useMemo, useState } from "react";
import { Page } from "@/components/layout/Page";
import { DownloadDialog } from "@/features/download";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import { useSearch, useSearchHistory } from "./hooks";
import type { SearchResult } from "./types";

export function SearchPage() {
  const {
    search,
    results,
    isLoading,
    error,
  } = useSearch();

  const { history, add, remove, clear } = useSearchHistory();
  const [downloadTarget, setDownloadTarget] = useState<SearchResult | null>(null);

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
      search({ query });
    },
    [add, search],
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
