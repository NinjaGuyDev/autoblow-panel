export type PlatformType = 'local' | 'youtube' | 'vimeo' | 'supported-embed' | 'unsupported-embed';
export type SyncMode = 'auto' | 'manual';

export interface PlatformConfig {
  platform: PlatformType;
  syncMode: SyncMode;
  canPlay: boolean;
  requiresManualOffset: boolean;
}
