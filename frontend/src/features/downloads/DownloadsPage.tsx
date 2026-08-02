import { useCallback, useMemo } from "react";
import { cancelJob, pauseJob, resumeJob } from "@/api";
import { Page } from "@/components/layout/Page";
import { useJobs } from "@/features/jobs/hooks";
import { useDownloadHistory, useActiveSongs } from "./hooks";
import { removeHistoryEntry, clearHistory } from "./history-store";
import { ActiveHeader } from "./ActiveHeader";
import { ActiveSongCard } from "./ActiveSongCard";
import { HistoryItem } from "./HistoryItem";
import { Music, Trash2 } from "lucide-react";

export function DownloadsPage() {
  const jobs = useJobs();
  const history = useDownloadHistory();
  const activeSongs = useActiveSongs();

  const handleCancel = useCallback(async (jobId: string) => {
    try {
      await cancelJob(jobId);
    } catch {
      // ignore
    }
  }, []);

  const handlePause = useCallback(async (jobId: string) => {
    try {
      await pauseJob(jobId);
    } catch {
      // ignore
    }
  }, []);

  const handleResume = useCallback(async (jobId: string) => {
    try {
      await resumeJob(jobId);
    } catch {
      // ignore
    }
  }, []);

  const handleRemove = useCallback((id: string) => {
    removeHistoryEntry(id);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
  }, []);

  const { completedHistory, failedHistory } = useMemo(() => {
    const completed: typeof history = [];
    const failed: typeof history = [];
    for (const entry of history) {
      if (entry.status === "failed") {
        failed.push(entry);
      } else {
        completed.push(entry);
      }
    }
    return { completedHistory: completed, failedHistory: failed };
  }, [history]);

  const playlistJobs = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const playlistJobIds = new Set(activeSongs.map((s) => s.jobId));
    const unique = [...playlistJobIds].map((id) => byId.get(id)).filter(Boolean);
    return unique;
  }, [jobs, activeSongs]);

  const hasActiveDownloads = activeSongs.length > 0;

  return (
    <Page className="h-full flex flex-col overflow-hidden">
      <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0">
          <h1 className="text-2xl font-semibold">Downloads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your music library
          </p>
        </div>

        {/* Active Downloads */}
        {hasActiveDownloads && (
          <section className="flex flex-col gap-3 shrink-0">
            <h2 className="text-sm font-medium text-muted-foreground">
              Active
            </h2>
            {playlistJobs.length > 0 &&
              playlistJobs.map((job) => {
                if (!job) return null;
                const meta = job.metadata as Record<string, unknown>;
                const total = (meta.total_tracks as number) || 0;
                const successful = (meta.successful as number) || 0;
                const isPaused = job.state === "paused";
                return (
                  <ActiveHeader
                    key={job.id}
                    playlistTitle={job.title ?? null}
                    completed={successful}
                    total={total}
                    isPaused={isPaused}
                    onCancelAll={() => handleCancel(job.id)}
                    onPauseAll={() => handlePause(job.id)}
                    onResumeAll={() => handleResume(job.id)}
                  />
                );
              })}
            <div className="flex flex-col gap-2">
              {activeSongs.map((song) => (
                <ActiveSongCard
                  key={song.id}
                  song={song}
                  onCancel={handleCancel}
                  onPause={handlePause}
                  onResume={handleResume}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed History */}
        <section className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-sm font-medium text-muted-foreground">
              Completed{completedHistory.length > 0 ? ` (${completedHistory.length})` : ""}
            </h2>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Trash2 className="size-3.5" />
                Clear all
              </button>
            )}
          </div>
          {completedHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Music className="size-8" />
              <p className="text-sm">No completed downloads</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
              {completedHistory.map((entry) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </section>

        {/* Failed History */}
        {failedHistory.length > 0 && (
          <section className="flex flex-col gap-3 shrink-0">
            <h2 className="text-sm font-medium text-muted-foreground">
              Failed ({failedHistory.length})
            </h2>
            <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 max-h-60">
              {failedHistory.map((entry) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Page>
  );
}
