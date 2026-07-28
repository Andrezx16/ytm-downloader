import { request } from "./client";

// --- Types ---

export interface SearchRequest {
  query: string;
  limit?: number;
  filter?: "songs" | "videos" | "all";
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

// --- API ---

export function search(params: SearchRequest, signal?: AbortSignal): Promise<SearchResult[]> {
  return request<SearchResult[]>("/search", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}
