import { FolderOpen, RotateCw, Trash2, XCircle } from "lucide-react";
import { openFolder } from "@/api";
import { JobStatus } from "./JobStatus";
import { JobProgress } from "./JobProgress";
import type { JobRecord } from "./types";

interface JobCardProps {
  job: JobRecord;
  onCancel: (id: string) => void;
  onClear: (id: string) => void;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function JobCard({ job, onCancel, onClear }: JobCardProps) {
  const isRunning = job.state === "queued" || job.state === "running";
  const isCompleted = job.state === "completed";
  const isFailed = job.state === "failed";

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {job.title || job.message || job.id}
          </p>
          {job.filepath && (
            <p className="truncate text-xs text-muted-foreground mt-0.5">
              {job.filepath}
            </p>
          )}
        </div>
        <JobStatus state={job.state} />
      </div>

      {isRunning && (
        <div className="mb-2">
          <JobProgress progress={job.progress} />
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {job.speed != null && (
              <span>{(job.speed / 1024 / 1024).toFixed(1)} MB/s</span>
            )}
            {job.eta != null && <span>ETA {formatEta(job.eta)}</span>}
          </div>
        </div>
      )}

      {isCompleted && job.filepath && (
        <button
          onClick={() => openFolder(job.filepath!)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FolderOpen className="size-3.5" />
          Open folder
        </button>
      )}

      {isFailed && job.error && (
        <p className="text-xs text-destructive mb-2">{job.error}</p>
      )}

      <div className="flex items-center gap-2 mt-2">
        {isRunning && (
          <button
            onClick={() => onCancel(job.id)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <XCircle className="size-3.5" />
            Cancel
          </button>
        )}
        {isFailed && (
          <button
            onClick={() => {
              // placeholder: retry
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <RotateCw className="size-3.5" />
            Retry
          </button>
        )}
        {(isCompleted || isFailed || job.state === "cancelled") && (
          <button
            onClick={() => onClear(job.id)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Trash2 className="size-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
