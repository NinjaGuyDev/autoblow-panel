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
  isCustomPattern?: number; // 0=regular library item, 1=custom pattern
  originalPatternId?: string | null; // Preset pattern ID this was copied from
  patternMetadata?: string | null; // JSON string with pattern metadata
}

export interface CreateLibraryItemRequest {
  videoName: string | null;
  funscriptName: string | null;
  funscriptData: string;
  duration: number | null;
  isCustomPattern?: number;
  originalPatternId?: string | null;
  patternMetadata?: string | null;
}

export interface SearchQuery {
  q?: string;
}

export interface MigrationRequest {
  data: CreateLibraryItemRequest[];
}
