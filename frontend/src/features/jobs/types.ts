import type { JobState } from "@/types";

export interface JobRecord {
  id: string;
  state: JobState;
  progress: number;
  message: string;
  title?: string;
  speed?: number;
  eta?: number;
  filepath?: string;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: number;
}

export type JobCategory = "active" | "completed";
