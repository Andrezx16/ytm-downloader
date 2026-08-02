export type JobState = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface Job<T = unknown> {
  id: string;
  state: JobState;
  progress: number;
  message: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  result: T | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  video_id: string;
  url: string;
  provider: string;
}

export interface PlaylistEntry {
  title: string;
  artist: string;
  duration: number;
  video_id: string;
  url: string;
  thumbnail: string;
  uploader: string;
  position: number;
  provider: string;
}

export interface PlaylistInfo {
  title: string;
  description: string;
  uploader: string;
  thumbnail: string;
  playlist_id: string;
  total_tracks: number;
  total_duration: number;
  entries: PlaylistEntry[];
}

export interface DownloadResult {
  file_path: string;
  title: string;
  artist: string;
  duration: number;
  size_bytes: number;
  video_id: string;
}

export interface PipelineResult {
  success: boolean;
  source_file: string;
  metadata: Record<string, unknown>;
  matches: unknown[];
  selected_match: unknown | null;
  lyrics: string | null;
  warnings: string[];
  errors: string[];
  elapsed_time: number;
}

export type Theme = "light" | "dark" | "system";
