export { ApiError } from "./errors";
export { request } from "./client";
export { search, getVideoInfo } from "./search";
export { download, openFolder } from "./download";
export { getPlaylist, downloadPlaylist } from "./playlist";
export { analyze, enrich, write, scanFolder, selectMatch, getFolders, analyzeStream, readTags, readFileLyrics, enrichDeezer } from "./pipeline";
export { getJob, cancelJob, pauseJob, resumeJob, subscribeJob } from "./jobs";
export { getAuthStatus, importCookies, removeCookies } from "./auth";

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
  EnrichDeezerRequest,
  EnrichDeezerResponse,
} from "./pipeline";
export type { JobStatus, JobEvent } from "./jobs";
export type { AuthStatus } from "./auth";
export type { JobState } from "../types";
