import { request } from "./client";

// --- Types ---

export interface AnalyzeRequest {
  path: string;
}

export interface AnalyzeResponse {
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
    metadata: Record<string, unknown>;
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

export function analyze(params: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/pipeline/analyze", {
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
