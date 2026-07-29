import type { DownloadRequest } from "@/api/download";

export type DownloadQuality = NonNullable<DownloadRequest["quality"]>;
export type DownloadContainer = NonNullable<DownloadRequest["container"]>;

export interface DownloadOptions {
  output_dir: string;
  quality: DownloadQuality;
  container: DownloadContainer;
  embed_thumbnail: boolean;
  embed_metadata: boolean;
}
