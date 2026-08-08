import { API_BASE_URL } from "./client";
import { request } from "./client";
import { ApiError } from "./errors";

// --- Types ---

export interface FolderItem {
  name: string;
  path: string;
}

export interface FolderBrowseResponse {
  path: string;
  parent: string | null;
  folders: FolderItem[];
}

export interface ScanRequest {
  path: string;
}

export interface ScanFile {
  path: string;
  name: string;
  size: number;
  mtime: number;
  ctime: number;
}

export interface AnalyzeRequest {
  path: string;
  overrides?: { title?: string; artist?: string; album?: string };
}

export interface FileInfo {
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  year: string;
  track: string;
  disc: string;
  album_artist: string;
  genre: string;
  lyrics: string;
}

export interface MatchCandidate {
  source: string;
  source_id: string | null;
  title: string;
  artist: string;
  album: string;
  album_artist: string | null;
  year: number | null;
  genre: string | null;
  track_number: number | null;
  disc_number: number | null;
  isrc: string | null;
  composer: string | null;
  duration_ms: number;
  cover_url: string | null;
  confidence: number | null;
}

export interface AnalyzeResponse {
  source_file: string;
  file_info: FileInfo;
  matches: MatchCandidate[];
  warnings: string[];
  errors: string[];
  elapsed_time: number;
}

export interface SelectRequest {
  path: string;
  matches: MatchCandidate[];
  selected_index: number;
}

export interface SelectResponse {
  match: MatchCandidate;
  lyrics: string | null;
  warnings: string[];
  errors: string[];
}

export interface EnrichRequest {
  path: string;
  selected_index?: number;
  write?: boolean;
}

export interface EnrichResponse {
  id: string;
  state: string;
  progress: number;
  message: string;
  result: {
    success: boolean;
    source_file: string;
    file_info: FileInfo;
    metadata: Record<string, unknown>;
    matches: MatchCandidate[];
    selected_match: MatchCandidate | null;
    lyrics: string | null;
    warnings: string[];
    errors: string[];
    elapsed_time: number;
    wrote_metadata: boolean;
  } | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface WriteRequest {
  path: string;
  metadata: Record<string, unknown>;
}

// --- API ---

export function scanFolder(params: ScanRequest, signal?: AbortSignal): Promise<ScanFile[]> {
  return request<ScanFile[]>("/pipeline/scan", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function analyze(params: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/pipeline/analyze", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function selectMatch(params: SelectRequest, signal?: AbortSignal): Promise<SelectResponse> {
  return request<SelectResponse>("/pipeline/select", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function enrich(params: EnrichRequest, signal?: AbortSignal): Promise<EnrichResponse> {
  return request<EnrichResponse>("/pipeline/enrich", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function write(params: WriteRequest, signal?: AbortSignal): Promise<void> {
  return request<void>("/pipeline/write", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function readTags(path: string, signal?: AbortSignal): Promise<Record<string, string>> {
  return request<Record<string, string>>("/pipeline/read-tags", {
    method: "POST",
    body: JSON.stringify({ path }),
    signal,
  });
}

export function readFileLyrics(path: string, signal?: AbortSignal): Promise<{ lyrics: string | null }> {
  return request<{ lyrics: string | null }>("/pipeline/read-lyrics", {
    method: "POST",
    body: JSON.stringify({ path }),
    signal,
  });
}

export interface EnrichDeezerRequest {
  matches: MatchCandidate[];
  selected_index: number;
}

export interface EnrichDeezerResponse {
  match: MatchCandidate;
  warning: string | null;
}

export function enrichDeezer(params: EnrichDeezerRequest, signal?: AbortSignal): Promise<EnrichDeezerResponse> {
  return request<EnrichDeezerResponse>("/pipeline/enrich-deezer", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
  });
}

export function getFolders(path: string, signal?: AbortSignal): Promise<FolderBrowseResponse> {
  const params = new URLSearchParams({ path });
  return request<FolderBrowseResponse>(`/folders?${params}`, { signal });
}

// --- M3U Parsing (client-side) ---

export function parseM3u(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const entries: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const name = trimmed.includes("/") || trimmed.includes("\\")
      ? trimmed.split(/[/\\]/).pop()!
      : trimmed;
    entries.push(name);
  }
  return entries;
}

// --- Streaming Types ---

export interface ProviderDoneEvent {
  event: "provider";
  source: string;
  matches: MatchCandidate[];
  elapsed_time: number;
}

export interface AnalysisCompleteEvent {
  event: "complete";
  source_file: string;
  file_info: FileInfo;
  all_matches: MatchCandidate[];
  warnings: string[];
  errors: string[];
  elapsed_time: number;
}

export interface AnalysisErrorEvent {
  event: "error";
  detail: string;
}

export type StreamEvent = ProviderDoneEvent | AnalysisCompleteEvent | AnalysisErrorEvent;

// --- Streaming API ---

export async function* analyzeStream(
  params: AnalyzeRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  const combinedSignal = signal
    ? combineSignals(signal, controller.signal)
    : controller.signal;

  try {
    const res = await fetch(`${API_BASE_URL}/pipeline/analyze-stream`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: { "Content-Type": "application/json" },
      signal: combinedSignal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body?.detail ?? res.statusText);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          yield JSON.parse(trimmed) as StreamEvent;
        }
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function combineSignals(external: AbortSignal, internal: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (external.aborted || internal.aborted) {
    controller.abort();
    return controller.signal;
  }
  external.addEventListener("abort", onAbort, { once: true });
  internal.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}
