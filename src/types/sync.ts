// Sync status enum for synchronization state management
export type SyncStatus = 'idle' | 'uploading' | 'ready' | 'playing' | 'paused' | 'error';

// State interface for sync playback
export interface SyncPlaybackState {
  syncStatus: SyncStatus;
  scriptUploaded: boolean;
  estimatedLatencyMs: number;
  driftMs: number;
  error: string | null;
}

