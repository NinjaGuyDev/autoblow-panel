/**
 * Navigation types for tab-based UI
 */

export type TabId = 'video-sync' | 'manual-control' | 'device-log';

export interface Tab {
  id: TabId;
  label: string;
}

export const TABS: readonly Tab[] = [
  { id: 'video-sync', label: 'Video Sync' },
  { id: 'manual-control', label: 'Manual Control' },
  { id: 'device-log', label: 'Device Log' },
] as const;
