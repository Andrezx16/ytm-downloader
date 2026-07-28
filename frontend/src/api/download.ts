import { request } from "./client";

// --- Types ---

export interface DownloadRequest {
  url: string;
  output_dir?: string;
  quality?: "best" | "high" | "medium" | "low";
  container?: "auto" | "m4a" | "opus" | "original";
  embed_thumbnail?: boolean;
  embed_metadata?: boolean;
}

export interface DownloadResponse {
  id: string;
  state: string;
  progress: number;
  message: string;
  result: {
    filepath: string;
    title: string;
    video_id: string;
  } | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

// --- API ---

export function download(params: DownloadRequest, signal?: AbortSignal): Promise<DownloadResponse> {
  return request<DownloadResponse>("/download", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}
