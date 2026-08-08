import { request } from "./client";

// --- Types ---

export interface SearchRequest {
  query: string;
  limit?: number;
  filter?: "songs" | "videos" | "all";
}

export interface SearchResult {
  video_id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail_url: string;
  duration_seconds: number;
  album: string | null;
  uploader: string | null;
  channel: string | null;
  search_position: number;
  source: string;
}

// --- API ---

export function search(params: SearchRequest, signal?: AbortSignal): Promise<SearchResult[]> {
  return request<SearchResult[]>("/search", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function getVideoInfo(params: { url: string }, signal?: AbortSignal): Promise<SearchResult> {
  return request<SearchResult>("/video-info", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}
