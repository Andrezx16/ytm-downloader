export { ApiError } from "./errors";
export { request } from "./client";
export { search } from "./search";
export { download, openFolder } from "./download";
export { getPlaylist, downloadPlaylist } from "./playlist";
export { analyze, enrich, write, scanFolder, selectMatch, getFolders, analyzeStream } from "./pipeline";
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
  ScanRequest,
  ScanFile,
  AnalyzeRequest,
  AnalyzeResponse,
  FileInfo,
  MatchCandidate,
  SelectRequest,
  SelectResponse,
  EnrichRequest,
  EnrichResponse,
  WriteRequest,
  FolderItem,
  FolderBrowseResponse,
  ProviderDoneEvent,
  AnalysisCompleteEvent,
  AnalysisErrorEvent,
  StreamEvent,
} from "./pipeline";
export type { JobStatus, JobEvent } from "./jobs";
export type { JobState } from "../types";
