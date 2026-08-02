import { FolderOpen, Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { openFolder, download } from "@/api";
import { trackJob } from "@/features/jobs";
import type { DownloadHistoryEntry } from "./types";

interface HistoryItemProps {
  entry: DownloadHistoryEntry;
  onRemove: (id: string) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildRetryUrl(entry: DownloadHistoryEntry): string | null {
  if (entry.url) return entry.url;
  if (entry.video_id) return `https://www.youtube.com/watch?v=${entry.video_id}`;
  return null;
}

export function HistoryItem({ entry, onRemove }: HistoryItemProps) {
  const isFailed = entry.status === "failed";

  async function handleRetry() {
    const url = buildRetryUrl(entry);
    if (!url) return;
    try {
      const response = await download({
        url,
        output_dir: entry.output_dir || undefined,
      });
      trackJob(response.id, entry.title);
    } catch {
      // ignore — job will appear in active downloads
    }
  }

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
        isFailed
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card"
      }`}
    >
      {entry.thumbnail_url ? (
        <img
          src={entry.thumbnail_url}
          alt=""
          className="size-10 rounded object-cover shrink-0"
          aria-hidden="true"
        />
      ) : (
        <div className="size-10 rounded bg-muted shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.artist || "Unknown artist"}
        </p>
        {isFailed && entry.error_message && (
          <p className="truncate text-xs text-destructive mt-0.5 flex items-center gap-1">
            <AlertCircle className="size-3 shrink-0" />
            {entry.error_message.replace(/^Failed\s*[:\-]?\s*/i, "")}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">
          {entry.duration_seconds != null ? formatDuration(entry.duration_seconds) : ""}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(entry.downloaded_at)}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isFailed ? (
          <button
            onClick={handleRetry}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Retry download"
          >
            <RotateCcw className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={() => openFolder(entry.filepath)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Open folder"
          >
            <FolderOpen className="size-3.5" />
          </button>
        )}
        <button
          onClick={() => onRemove(entry.id)}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          aria-label="Remove from history"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
