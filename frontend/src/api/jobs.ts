import { request, API_BASE_URL } from "./client";
import { ApiError } from "./errors";
import type { JobState } from "../types";

// --- Types ---

export interface JobStatus {
  id: string;
  state: JobState;
  progress: number;
  message: string;
  result: unknown;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface JobEvent {
  id: string;
  state: JobState;
  progress: number;
  message: string;
  metadata: Record<string, unknown>;
  error: string | null;
}

// --- API ---

export function getJob(id: string, signal?: AbortSignal): Promise<JobStatus> {
  return request<JobStatus>(`/jobs/${id}`, { signal });
}

export function cancelJob(id: string, signal?: AbortSignal): Promise<JobStatus> {
  return request<JobStatus>(`/jobs/${id}/cancel`, {
    method: "POST",
    signal,
  });
}

export function subscribeJob(
  id: string,
  onEvent: (event: JobEvent) => void,
  onError?: (error: ApiError) => void,
): () => void {
  const es = new EventSource(`${API_BASE_URL}/jobs/${id}/events`);

  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as JobEvent;
      onEvent(data);
    } catch {
      // malformed event, ignore
    }
  };

  es.onerror = () => {
    es.close();
    onError?.(new ApiError(0, "SSE connection lost"));
  };

  return () => es.close();
}
