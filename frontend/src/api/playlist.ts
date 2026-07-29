import { request } from "./client";

// --- Types ---

export interface PlaylistRequest {
  url: string;
}

export interface PlaylistEntry {
  title: string;
  artist: string;
  duration_seconds: number;
  video_id: string;
  url: string;
  thumbnail_url: string;
  uploader: string;
  position: number;
  provider: string;
}

export interface PlaylistInfo {
  title: string;
  description: string;
  uploader: string;
  thumbnail_url: string;
  playlist_id: string;
  total_tracks: number;
  total_duration: number;
  entries: PlaylistEntry[];
}

export interface PlaylistDownloadRequest {
  url: string;
  selected?: number[];
  output_dir?: string;
  quality?: "best" | "high" | "medium" | "low";
  container?: "auto" | "m4a" | "opus" | "original";
  embed_thumbnail?: boolean;
  embed_metadata?: boolean;
}

export interface PlaylistDownloadResponse {
  id: string;
  state: string;
  progress: number;
  message: string;
  result: {
    successful: number;
    failed: number;
    skipped: number;
    cancelled: boolean;
    elapsed_time: number;
    output_directory: string;
  } | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

// --- API ---

export function getPlaylist(params: PlaylistRequest, signal?: AbortSignal): Promise<PlaylistInfo> {
  return request<PlaylistInfo>("/playlist", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function downloadPlaylist(
  params: PlaylistDownloadRequest,
  signal?: AbortSignal,
): Promise<PlaylistDownloadResponse> {
  return request<PlaylistDownloadResponse>("/playlist/download", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}
