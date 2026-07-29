import type { MatchCandidate, ScanFile } from "@/api/pipeline";

export type MetadataStep = "scan" | "processing" | "done";

export type QueueEntryStatus =
  | "pending"
  | "analyzing"
  | "ready"
  | "skipped"
  | "completed"
  | "error";

export interface QueueEntry {
  file: ScanFile;
  status: QueueEntryStatus;
  matches: MatchCandidate[];
  loadingProviders: Set<string>;
  selectedIndex: number | null;
  fields: MetadataFields | null;
  lyrics: string | null;
  error: string | null;
  abortController: AbortController | null;
}

export interface MetadataFields {
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  genre: string;
  year: string;
  track: string;
  disc: string;
  lyrics: string;
  cover_url: string;
}

export const EMPTY_FIELDS: MetadataFields = {
  title: "",
  artist: "",
  album: "",
  album_artist: "",
  genre: "",
  year: "",
  track: "",
  disc: "",
  lyrics: "",
  cover_url: "",
};

export function matchToFields(match: MatchCandidate, lyrics?: string | null): MetadataFields {
  return {
    title: match.title ?? "",
    artist: match.artist ?? "",
    album: match.album ?? "",
    album_artist: match.album_artist ?? "",
    genre: match.genre ?? "",
    year: match.year != null ? String(match.year) : "",
    track: match.track_number != null ? String(match.track_number) : "",
    disc: match.disc_number != null ? String(match.disc_number) : "",
    lyrics: lyrics ?? "",
    cover_url: match.cover_url ?? "",
  };
}
