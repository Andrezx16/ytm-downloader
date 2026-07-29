import { SearchX, AlertCircle } from "lucide-react";
import { SearchCard } from "./SearchCard";
import type { SearchResult, SearchState } from "./types";
import type { ApiError } from "@/api/errors";

interface SearchResultsProps {
  state: SearchState;
  results?: SearchResult[];
  error?: ApiError | null;
  onDownload: (result: SearchResult) => void;
}

export function SearchResults({
  state,
  results,
  error,
  onDownload,
}: SearchResultsProps) {
  if (state === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Searching...</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-destructive">
        <AlertCircle className="size-8" />
        <p className="text-sm font-medium">Search failed</p>
        <p className="text-xs text-muted-foreground">
          {error?.message ?? "An unexpected error occurred"}
        </p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <SearchX className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No results found</p>
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <SearchX className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Search for songs, artists, or albums
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {results?.map((result) => (
        <SearchCard
          key={result.video_id}
          result={result}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
