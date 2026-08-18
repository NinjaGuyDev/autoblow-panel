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

// === Device Control API Types ===

export interface FunscriptActionDto {
  pos: number;
  at: number;
}

export interface DeviceConnectRequest {
  deviceKey: string;
}

export interface DeviceConnectResponse {
  status: 'connected';
  latencyMs: number;
}

export interface DeviceStatusResponse {
  connection: 'connected' | 'disconnected';
  playback: 'playing' | 'paused' | 'stopped';
  durationMs: number;
  looping: boolean;
  lastError: string | null;
}

export interface DevicePlayRequest {
  actions: FunscriptActionDto[];
}

export interface DevicePlayResponse {
  status: 'playing';
  durationMs: number;
  name?: string;
}

export interface DeviceStopResponse {
  status: 'stopped';
}

export interface DeviceDisconnectResponse {
  status: 'disconnected';
}

// === Script Mod Types (Live Speed Control & Script Mods) ===

/**
 * How a mod's ops are laid out over a script.
 * - `continuous` — ops fill the whole script, cycling in order.
 * - `sequence-burst` — the op list runs as one burst, repeated at trigger points.
 */
export type ScriptModKind = 'sequence-burst' | 'continuous';

/**
 * A duration is either exact (`fixed`) or drawn uniformly from `[min, max]`.
 * Exactly one of those two forms must be supplied.
 */
export interface ModDurationSpec {
  fixed?: number | null;
  min?: number | null;
  max?: number | null;
}

/** Hold a constant speed factor for a duration. */
export interface ModSpeedOp {
  op: 'speed';
  factor: number;
  durationMs: ModDurationSpec;
}

/** Hold a speed drawn uniformly from `range` for a duration, then redraw. */
export interface ModRandomSpeedOp {
  op: 'randomSpeed';
  range: number[]; // [min, max] — tuple validated by schema, array for JSON portability
  holdMs: ModDurationSpec;
}

/**
 * Freeze the device at its current position.
 * In `continuous` mods a pause is offered once every `minGapMs` and taken with
 * `probabilityPerWindow`; in `sequence-burst` mods it fires wherever it sits
 * in the op list and both fields are ignored.
 */
export interface ModPauseOp {
  op: 'pause';
  durationMs: ModDurationSpec;
  minGapMs: number;
  probabilityPerWindow: number;
}

export type ScriptModOp = ModSpeedOp | ModRandomSpeedOp | ModPauseOp;

/** Placement rule for `sequence-burst` mods. */
export interface ScriptModTrigger {
  type: 'random';
  minGapMs: number;
}

export interface ScriptModDefinition {
  version: number;
  kind: ScriptModKind;
  ops: ScriptModOp[];
  trigger?: ScriptModTrigger | null;
}

export interface ScriptMod {
  id: number;
  name: string;
  description: string | null;
  definition: ScriptModDefinition;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

export interface CreateScriptModRequest {
  name: string;
  description?: string | null;
  definition: ScriptModDefinition;
}

export interface UpdateScriptModRequest {
  name?: string;
  description?: string | null;
  definition?: ScriptModDefinition;
}

export interface GenerateScriptModRequest {
  instruction: string;
  scriptDurationMs?: number | null;
}

export interface GenerateScriptModResponse {
  definition: ScriptModDefinition;
  modelNotes: string | null;
}
