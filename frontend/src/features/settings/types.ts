import type { DownloadQuality, DownloadContainer } from "@/features/download/types";

export interface DownloadSettings {
  quality: DownloadQuality;
  container: DownloadContainer;
  embed_thumbnail: boolean;
  embed_metadata: boolean;
}

export interface PlaylistSettings {
  quality: DownloadQuality;
  container: DownloadContainer;
  embed_thumbnail: boolean;
  embed_metadata: boolean;
  skip_existing: boolean;
  retries: number;
}

export interface Settings {
  downloads: DownloadSettings;
  playlist: PlaylistSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  downloads: {
    quality: "best",
    container: "auto",
    embed_thumbnail: true,
    embed_metadata: true,
  },
  playlist: {
    quality: "best",
    container: "auto",
    embed_thumbnail: true,
    embed_metadata: true,
    skip_existing: false,
    retries: 2,
  },
};
