import type { DownloadOptions } from "@/features/download/types";

export interface PlaylistTrack {
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

export interface PlaylistData {
  title: string;
  description: string;
  uploader: string;
  thumbnail_url: string;
  playlist_id: string;
  total_tracks: number;
  total_duration: number;
  entries: PlaylistTrack[];
}

export type PlaylistDownloadOptions = DownloadOptions;
