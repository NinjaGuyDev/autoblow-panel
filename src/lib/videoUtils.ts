import ReactPlayer from 'react-player';
import type { PlatformConfig } from '../types/video';

/**
 * Check if a video name is an embed URL (http:// or https://)
 */
export function isEmbedUrl(videoName: string | null): boolean {
  if (!videoName) return false;
  return videoName.startsWith('http://') || videoName.startsWith('https://');
}

/**
 * Detect platform configuration for a given video source
 * Returns platform type, sync mode, playability, and manual offset requirement
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

  // Check if ReactPlayer can play this URL
  const canPlay = videoName && typeof ReactPlayer.canPlay === 'function' ? ReactPlayer.canPlay(videoName) : false;

  // Detect specific platforms
  if (/youtube\.com|youtu\.be/i.test(videoName!)) {
    return {
      platform: 'youtube',
      syncMode: 'auto',
      canPlay: true,
      requiresManualOffset: false,
    };
  }

  if (/vimeo\.com/i.test(videoName!)) {
    return {
      platform: 'vimeo',
      syncMode: 'auto',
      canPlay: true,
      requiresManualOffset: false,
    };
  }

  // Other supported platforms
  if (canPlay) {
    return {
      platform: 'supported-embed',
      syncMode: 'auto',
      canPlay: true,
      requiresManualOffset: false,
    };
  }

  // Unsupported platform - requires manual sync
  return {
    platform: 'unsupported-embed',
    syncMode: 'manual',
    canPlay: false,
    requiresManualOffset: true,
  };
}
