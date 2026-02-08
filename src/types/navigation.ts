/**
 * Navigation types for tab-based UI
 */

export type TabId = 'library' | 'playlists' | 'video-sync' | 'manual-control' | 'device-log' | 'pattern-library';

export interface Tab {
  id: TabId;
  label: string;
}

export const TABS: readonly Tab[] = [
  { id: 'library', label: 'Library' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'video-sync', label: 'Video Sync' },
  { id: 'manual-control', label: 'Manual Control' },
  { id: 'device-log', label: 'Device Log' },
  { id: 'pattern-library', label: 'Pattern Library' },
] as const;
