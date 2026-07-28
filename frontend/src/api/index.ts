export { ApiError } from "./errors";
export { request } from "./client";
export { search } from "./search";
export { download } from "./download";
export { getPlaylist, downloadPlaylist } from "./playlist";
export { analyze, enrich, write } from "./pipeline";
export { getJob, cancelJob, subscribeJob } from "./jobs";

export type { SearchRequest, SearchResult } from "./search";
export type { DownloadRequest, DownloadResponse } from "./download";
export type {
  PlaylistRequest,
  PlaylistInfo,
  PlaylistEntry,
  PlaylistDownloadRequest,
  PlaylistDownloadResponse,
} from "./playlist";
export type {
  AnalyzeRequest,
  AnalyzeResponse,
  EnrichRequest,
  EnrichResponse,
  WriteRequest,
} from "./pipeline";
export type { JobStatus, JobEvent } from "./jobs";
export type { JobState } from "../types";
