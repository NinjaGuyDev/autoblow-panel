import type { RefObject } from 'react';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useEmbedPlayback } from '@/hooks/useEmbedPlayback';
import { useManualSync } from '@/hooks/useManualSync';
import { isEmbedUrl, detectPlatformConfig } from '@/lib/videoUtils';

interface UseUnifiedPlaybackOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string | null;
  videoName: string | null;
  embedPlayerRef: RefObject<HTMLVideoElement | null>;
}

/**
 * Unifies local video playback and embed playback behind a single interface.
 * Detects whether the loaded video is an embed URL and selects the appropriate
 * playback system, exposing unified active* values for consumers.
 */
export function useUnifiedPlayback({
  videoRef,
  videoUrl,
  videoName,
  embedPlayerRef,
}: UseUnifiedPlaybackOptions) {
  const localPlayback = useVideoPlayback(videoRef, videoUrl);

  const isEmbed = isEmbedUrl(videoName);
  const platformConfig = detectPlatformConfig(isEmbed ? videoUrl : null);
  const iframeEmbed = isEmbed && !platformConfig.canPlay;

  const embedPlayback = useEmbedPlayback({
    playerRef: embedPlayerRef,
    embedUrl: isEmbed ? videoUrl : null,
  });

  const manualSync = useManualSync(platformConfig.requiresManualOffset && isEmbed);

  return {
    // Unified active values
    activeIsPlaying: isEmbed ? embedPlayback.isPlaying : localPlayback.isPlaying,
    activeCurrentTime: isEmbed ? embedPlayback.currentTime : localPlayback.currentTime,
    activeDuration: isEmbed ? embedPlayback.duration : localPlayback.duration,
    activeTogglePlayPause: isEmbed ? embedPlayback.togglePlayPause : localPlayback.togglePlayPause,
    activeSeek: isEmbed ? embedPlayback.seek : localPlayback.seek,
    activePlaybackError: isEmbed ? embedPlayback.error : localPlayback.error,
    // Embed detection
    isEmbed,
    platformConfig,
    iframeEmbed,
    // Sub-hook returns for direct access
    localPlayback,
    embedPlayback,
    manualSync,
  };
}
