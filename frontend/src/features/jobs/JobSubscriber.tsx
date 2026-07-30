import { useEffect, useRef } from "react";
import { subscribeJob, getJob } from "@/api";
import type { JobEvent } from "@/api/jobs";
import { updateJob, getJobSnapshot, useJobsStore } from "./store";

const ACTIVE_STATES = new Set(["queued", "running"]);

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
}

export function JobSubscriber() {
  const jobs = useJobsStore();
  const jobIds = jobs.map((j) => j.id);
  const subsRef = useRef<Map<string, () => void>>(new Map());

  // Subscribe to new active jobs, unsubscribe removed jobs
  useEffect(() => {
    const next = new Set(jobIds);

    // Unsubscribe jobs no longer in the list
    for (const [id, unsub] of subsRef.current) {
      if (!next.has(id)) {
        unsub();
        subsRef.current.delete(id);
      }
    }

    // Subscribe to new active jobs (only if not already subscribed)
    for (const id of next) {
      if (subsRef.current.has(id)) continue;
      const snap = getJobSnapshot(id);
      if (!snap || !ACTIVE_STATES.has(snap.state)) continue;

      const unsub = subscribeJob(
        id,
        (event) => syncFromEvent(id, event),
        async () => {
          // On SSE error: close, refetch, re-subscribe if still active
          subsRef.current.delete(id);
          try {
            const data = await getJob(id);
            syncFromEvent(id, data);
            const s = getJobSnapshot(id);
            if (s && ACTIVE_STATES.has(s.state)) {
              // Re-subscribe (will create new EventSource)
              const retryUnsub = subscribeJob(
                id,
                (event) => syncFromEvent(id, event),
              );
              subsRef.current.set(id, retryUnsub);
            }
          } catch {
            // ignore
          }
        },
      );

      subsRef.current.set(id, unsub);
    }
  }, [jobIds]);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      for (const [, unsub] of subsRef.current) {
        unsub();
      }
      subsRef.current.clear();
    };
  }, []);

  return null;
}
