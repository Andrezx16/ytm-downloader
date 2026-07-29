import { Download } from "lucide-react";
import type { SearchResult } from "./types";

interface SearchCardProps {
  result: SearchResult;
  onDownload: (result: SearchResult) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SearchCard({
  result,
  onDownload,
}: SearchCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50">
      <img
        src={result.thumbnail_url}
        alt=""
        className="size-12 rounded object-cover"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{result.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {result.artist}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">
        {formatDuration(result.duration_seconds)}
      </span>
      <button
        onClick={() => onDownload(result)}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label={`Download ${result.title}`}
      >
        <Download className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
