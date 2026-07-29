import type { SearchResult as ApiSearchResult } from "@/api/search";

export type SearchState = "idle" | "loading" | "success" | "empty" | "error";

export interface SearchQuery {
  query: string;
}

export type SearchResult = ApiSearchResult;
