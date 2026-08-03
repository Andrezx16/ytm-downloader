import { useSyncExternalStore } from "react";
import type { JobRecord } from "./types";

// --- Internal store state ---

const _jobs = new Map<string, JobRecord>();
const _jobIds = new Set<string>();
let _listeners: Array<() => void> = [];

function _emit() {
  for (const fn of _listeners) fn();
}

// --- Mutations ---

export function addJob(job: JobRecord) {
  _jobs.set(job.id, job);
  _jobIds.add(job.id);
  _emit();
}

export function updateJob(id: string, patch: Partial<JobRecord>) {
  const job = _jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
  _emit();
}

export function removeJob(id: string) {
  _jobs.delete(id);
  _jobIds.delete(id);
  _emit();
}

// --- Read helpers ---

export function getJobSnapshot(id: string): JobRecord | undefined {
  return _jobs.get(id);
}

/** Returns the internal Set directly — callers must not mutate it. */
export function getAllJobIds(): ReadonlySet<string> {
  return _jobIds;
}

export function onStoreChange(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

// --- Derived / sorted snapshot ---

function _buildSorted(): JobRecord[] {
  return Array.from(_jobs.values()).sort((a, b) => b.created_at - a.created_at);
}

function _metaFingerprint(meta: Record<string, unknown>): string {
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

function _sortedKey(jobs: JobRecord[]): string {
  let key = "";
  for (const j of jobs) {
    key += `${j.id}:${j.state}:${j.progress}:${_metaFingerprint(j.metadata)};`;
  }
  return key;
}

// Stable snapshot reference: only replaced when the fingerprint changes.
let _cachedSorted: JobRecord[] = [];
let _cachedKey = "";

function _getSnapshot(): JobRecord[] {
  const next = _buildSorted();
  const key = _sortedKey(next);
  if (key !== _cachedKey) {
    _cachedKey = key;
    _cachedSorted = next;
  }
  return _cachedSorted;
}

function _subscribe(cb: () => void): () => void {
  _listeners.push(cb);
  return () => {
    _listeners = _listeners.filter((fn) => fn !== cb);
  };
}

// --- Hook ---

/**
 * Returns the sorted list of job records, re-rendering only when
 * the fingerprint actually changes. Uses useSyncExternalStore (React 18)
 * for concurrency-safe subscription.
 */
export function useJobsStore(): JobRecord[] {
  return useSyncExternalStore(_subscribe, _getSnapshot);
}

