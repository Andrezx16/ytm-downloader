import { useEffect, useRef } from "react";
import { subscribeJob, getJob } from "@/api";
import type { JobEvent } from "@/api/jobs";
import { addHistoryEntry } from "@/features/downloads/history-store";
import { updateJob, getJobSnapshot, getAllJobIds, onStoreChange } from "./store";

const ACTIVE_STATES = new Set(["queued", "running", "paused"]);
const TERMINAL_STATES = new Set(["completed", "failed", "cancelled"]);

function createHistoryId(jobId: string, videoId: string | undefined): string {
  return videoId ? `${jobId}-${videoId}` : jobId;
}

function tryAddHistory(jobId: string, event: JobEvent) {
  const meta = event.metadata ?? {};

  // `completed_songs` is a cumulative list that the backend appends to each time
  // a song finishes. It never gets cleared during the download, so SSE polling
  // always sees the full set of finished songs regardless of timing.
  const completedSongs = meta.completed_songs as
    | Array<{
        title?: string;
        artist?: string;
        thumbnail_url?: string;
        duration_seconds?: number;
        video_id?: string;
        filepath?: string;
        output_directory?: string;
      }>
    | undefined;

  if (completedSongs && completedSongs.length > 0) {
    for (const song of completedSongs) {
      if (!song.filepath || !song.title) continue;
      addHistoryEntry({
        id: createHistoryId(jobId, song.video_id),
        title: song.title,
        artist: song.artist ?? "",
        thumbnail_url: song.thumbnail_url ?? "",
        duration_seconds: song.duration_seconds ?? 0,
        filepath: song.filepath,
        output_dir: song.output_directory ?? "",
        downloaded_at: Date.now(),
        status: "completed",
      });
    }
  }

  // `failed_songs` is a cumulative list of songs that failed permanently.
  const failedSongs = meta.failed_songs as
    | Array<{
        title?: string;
        artist?: string;
        thumbnail_url?: string;
        duration_seconds?: number;
        video_id?: string;
        url?: string;
        output_directory?: string;
        error_message?: string;
      }>
    | undefined;

  if (failedSongs && failedSongs.length > 0) {
    for (const song of failedSongs) {
      if (!song.title) continue;
      addHistoryEntry({
        id: createHistoryId(jobId, song.video_id),
        title: song.title,
        artist: song.artist ?? "",
        thumbnail_url: song.thumbnail_url ?? "",
        duration_seconds: song.duration_seconds ?? 0,
        filepath: "",
        output_dir: song.output_directory ?? "",
        downloaded_at: Date.now(),
        status: "failed",
        error_message: song.error_message ?? "Download failed",
        video_id: song.video_id,
        url: song.url,
      });
    }
  }

  // Fallback for single-track (search) downloads: use filepath from metadata
  // when the job reaches a terminal state.
  const filepath = meta.filepath as string | undefined;
  if (!filepath) return;

  if (TERMINAL_STATES.has(event.state)) {
    const snap = getJobSnapshot(jobId);
    const isFailed = event.state === "failed" || event.state === "cancelled";
    addHistoryEntry({
      id: jobId,
      title: (meta.title as string) || snap?.title || "Download",
      artist: (meta.artist as string) ?? null,
      thumbnail_url: (meta.thumbnail_url as string) ?? null,
      duration_seconds: (meta.duration_seconds as number) ?? null,
      filepath,
      output_dir: (meta.output_directory as string) ?? "",
      downloaded_at: Date.now(),
      status: isFailed ? "failed" : "completed",
      error_message: isFailed ? (event.error ?? "Download failed") : undefined,
      video_id: (meta.video_id as string) ?? undefined,
      url: (meta.url as string) ?? undefined,
    });
  }
}

function syncFromEvent(id: string, event: JobEvent) {
  const snap = getJobSnapshot(id);
  updateJob(id, {
    state: event.state,
    progress: event.progress,
    message: event.message,
    error: event.error,
    metadata: event.metadata,
    title: (event.metadata?.title as string) || snap?.title,
    speed: event.metadata?.speed_bytes_per_second as number | undefined,
    eta: event.metadata?.eta_seconds as number | undefined,
    filepath: event.metadata?.filepath as string | undefined,
  });
  tryAddHistory(id, event);
}

function subscribeToJob(id: string, subsRef: Map<string, () => void>) {
  if (subsRef.has(id)) return;

  const snap = getJobSnapshot(id);
  if (!snap || !ACTIVE_STATES.has(snap.state)) return;

  const unsub = subscribeJob(
    id,
    (event) => syncFromEvent(id, event),
    async () => {
      subsRef.delete(id);
      try {
        const data = await getJob(id);
        syncFromEvent(id, data);
        const s = getJobSnapshot(id);
        if (s && ACTIVE_STATES.has(s.state)) {
          const retryUnsub = subscribeJob(
            id,
            (event) => syncFromEvent(id, event),
          );
          subsRef.set(id, retryUnsub);
        }
      } catch {
        // ignore
      }
    },
  );
  subsRef.set(id, unsub);
}

export function JobSubscriber() {
  const subsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    function checkNewJobs() {
      const allIds = getAllJobIds();
      for (const id of allIds) {
        subscribeToJob(id, subsRef.current);
      }
      for (const [id, unsub] of subsRef.current) {
        if (!allIds.has(id)) {
          unsub();
          subsRef.current.delete(id);
        }
      }
    }

    const unsub = onStoreChange(checkNewJobs);
    checkNewJobs();

    return () => {
      unsub();
      for (const [, unsubJob] of subsRef.current) {
        unsubJob();
      }
      subsRef.current.clear();
    };
  }, []);

  return null;
}
