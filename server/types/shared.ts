/**
 * Shared types between frontend and backend for type-safe API contract
 */

export interface LibraryItem {
  id: number;
  videoName: string | null;
  funscriptName: string | null;
  funscriptData: string; // JSON stringified funscript
  lastModified: string; // ISO 8601 timestamp
  duration: number | null; // Video duration in seconds
}

export interface CreateLibraryItemRequest {
  videoName: string | null;
  funscriptName: string | null;
  funscriptData: string;
  duration: number | null;
}

export interface SearchQuery {
  q?: string;
}

export interface MigrationRequest {
  data: CreateLibraryItemRequest[];
}
