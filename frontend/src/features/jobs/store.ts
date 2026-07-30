import { useState, useCallback, useRef, useEffect } from "react";
import type { JobRecord } from "./types";

interface JobsStore {
  jobs: Map<string, JobRecord>;
}

const store: JobsStore = { jobs: new Map() };
let listeners: Array<() => void> = [];

function emit() {
  for (const fn of listeners) fn();
}

export function addJob(job: JobRecord) {
  store.jobs.set(job.id, job);
  emit();
}

export function updateJob(id: string, patch: Partial<JobRecord>) {
  const job = store.jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
  emit();
}

export function removeJob(id: string) {
  store.jobs.delete(id);
  emit();
}

export function getJobSnapshot(id: string): JobRecord | undefined {
  return store.jobs.get(id);
}

export function getAllJobIds(): Set<string> {
  return new Set(store.jobs.keys());
}

export function onStoreChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function buildSorted(): JobRecord[] {
  return Array.from(store.jobs.values()).sort(
    (a, b) => b.created_at - a.created_at,
  );
}

function metaFingerprint(meta: Record<string, unknown>): string {
  const ct = meta.current_track as Record<string, unknown> | undefined;
  return [
    meta.song_percent ?? "",
    meta.speed_bytes_per_second ?? "",
    meta.eta_seconds ?? "",
    meta.filepath ?? "",
    ct?.video_id ?? "",
    ct?.title ?? "",
  ].join(":");
}

function sortedKey(jobs: JobRecord[]): string {
  let key = "";
  for (const j of jobs) {
    key += `${j.id}:${j.state}:${j.progress}:${metaFingerprint(j.metadata)};`;
  }
  return key;
}

export function useJobsStore(): JobRecord[] {
  const [state, setState] = useState<JobRecord[]>(buildSorted);
  const prevKeyRef = useRef(sortedKey(state));

  const subscribe = useCallback(() => {
    const listener = () => {
      const next = buildSorted();
      const key = sortedKey(next);
      if (key !== prevKeyRef.current) {
        prevKeyRef.current = key;
        setState(next);
      }
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((fn) => fn !== listener);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);

  return state;
}
