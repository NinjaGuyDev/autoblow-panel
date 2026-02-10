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
  deletedAt?: string | null; // ISO 8601 timestamp for soft delete
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

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;       // ISO 8601
  lastModified: string;    // ISO 8601
  itemCount?: number;      // Computed in queries, not stored
}

export interface PlaylistItem {
  id: number;
  playlistId: number;
  libraryItemId: number;
  position: number;
  // Joined fields from library_items (populated in queries)
  videoName?: string | null;
  funscriptName?: string | null;
  duration?: number | null;
}

export interface CreatePlaylistRequest {
  name: string;
  description?: string | null;
}

export interface UpdatePlaylistRequest {
  name?: string;
  description?: string | null;
}

export interface AddPlaylistItemRequest {
  libraryItemId: number;
}

export interface ReorderPlaylistItemsRequest {
  itemIds: number[];  // Full ordered list of playlist_item IDs in new order
}

// === Session Analytics Types (Phase 17) ===

export interface Session {
  id: number;
  startedAt: string;           // ISO 8601
  endedAt: string | null;
  durationSeconds: number | null;
  scriptOrder: string;         // JSON: Array<ScriptOrderEntry>
  libraryItemId: number | null;
  context: string;             // 'normal' | 'demo' | 'manual'
}

export interface ScriptOrderEntry {
  libraryItemId: number;
  timestamp: string;           // ISO 8601
}

export interface CreateSessionRequest {
  startedAt: string;
  libraryItemId?: number | null;
  context: string;
  scriptOrder?: string;        // JSON string, defaults to '[]'
}

export interface UpdateSessionRequest {
  endedAt?: string | null;
  durationSeconds?: number | null;
  scriptOrder?: string | null;
}

export interface ClimaxRecord {
  id: number;
  sessionId: number | null;
  timestamp: string;           // ISO 8601
  runwayData: string;          // JSON: Array<{pos: number, at: number}>
  libraryItemId: number | null;
  createdAt: string;           // ISO 8601
}

export interface CreateClimaxRecordRequest {
  sessionId?: number | null;
  timestamp: string;
  runwayData: string;          // JSON string
  libraryItemId?: number | null;
}

export interface PauseEvent {
  id: number;
  sessionId: number;
  timestamp: string;           // ISO 8601
  resumedAt: string | null;
  durationSeconds: number | null;
}

export interface CreatePauseEventRequest {
  sessionId: number;
  timestamp: string;
}

export interface UpdatePauseEventRequest {
  resumedAt?: string | null;
  durationSeconds?: number | null;
}

export interface SessionStats {
  totalSessions: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
}

export interface MostPlayedScript {
  libraryItemId: number;
  playCount: number;
  totalDurationSeconds: number;
}
