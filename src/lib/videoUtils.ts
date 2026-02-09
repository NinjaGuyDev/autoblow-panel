import type { PlatformConfig } from '../types/video';

/**
 * Check if a video name is an embed URL (http:// or https://)
 */
export function isEmbedUrl(videoName: string | null): boolean {
  if (!videoName) return false;
  return videoName.startsWith('http://') || videoName.startsWith('https://');
}

// Platforms with JS API support via ReactPlayer (programmatic play/pause/seek)
const SUPPORTED_PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: 'youtube' | 'vimeo' | 'supported-embed' }> = [
  { pattern: /(?:youtu\.be\/|youtube(?:-nocookie|education)?\.com\/)/i, platform: 'youtube' },
  { pattern: /vimeo\.com\//i, platform: 'vimeo' },
  { pattern: /(?:wistia\.(?:com|net)|wi\.st)\/(?:medias|embed)\//i, platform: 'supported-embed' },
  { pattern: /open\.spotify\.com\//i, platform: 'supported-embed' },
  { pattern: /(?:www\.|go\.)?twitch\.tv\//i, platform: 'supported-embed' },
  { pattern: /tiktok\.com\/(?:player|share|@)/i, platform: 'supported-embed' },
  { pattern: /stream\.mux\.com\//i, platform: 'supported-embed' },
  // Direct media file URLs (mp4, webm, etc.)
  { pattern: /\.(mp4|og[gv]|webm|mov|m4v|m3u8|mpd)($|\?|#)/i, platform: 'supported-embed' },
];

/**
 * Detect platform configuration for a given video source.
 * Uses explicit URL pattern matching instead of ReactPlayer.canPlay
 * to ensure consistent behavior and a single source of truth.
 */
export function detectPlatformConfig(videoName: string | null): PlatformConfig {
  // Local files
  if (!isEmbedUrl(videoName)) {
    return {
      platform: 'local',
      syncMode: 'auto',
      canPlay: true,
      requiresManualOffset: false,
    };
  }

  // Match against known supported platforms
  for (const { pattern, platform } of SUPPORTED_PLATFORM_PATTERNS) {
    if (pattern.test(videoName!)) {
      return {
        platform,
        syncMode: 'auto',
        canPlay: true,
        requiresManualOffset: false,
      };
    }
  }

  // Unsupported platform - requires iframe embed with manual sync
  return {
    platform: 'unsupported-embed',
    syncMode: 'manual',
    canPlay: false,
    requiresManualOffset: true,
  };
}
