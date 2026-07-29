import { useCallback } from "react";
import { getJob, cancelJob } from "@/api";
import { addJob, updateJob, useJobsStore } from "./store";
import type { JobRecord } from "./types";

export function useJobs(): JobRecord[] {
  return useJobsStore();
}

export function useJob(jobId: string | null) {
  const jobs = useJobsStore();
  const job = jobId ? jobs.find((j) => j.id === jobId) ?? null : null;

  const refetch = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await getJob(jobId);
      updateJob(jobId, {
        state: data.state,
        progress: data.progress,
        message: data.message,
        error: data.error,
        metadata: data.metadata,
        title: (data.metadata?.title as string) || undefined,
        speed: data.metadata?.speed_bytes_per_second as number | undefined,
        eta: data.metadata?.eta_seconds as number | undefined,
        filepath: data.metadata?.filepath as string | undefined,
      });
    } catch {
      // ignore
    }
  }, [jobId]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    try {
      await cancelJob(jobId);
      await refetch();
    } catch {
      // ignore
    }
  }, [jobId, refetch]);

  return { job, cancel, refetch };
}

export function trackJob(jobId: string, title?: string) {
  addJob({
    id: jobId,
    state: "queued",
    progress: 0,
    message: "Queued",
    title,
    error: null,
    metadata: {},
    created_at: Date.now(),
  });
}
