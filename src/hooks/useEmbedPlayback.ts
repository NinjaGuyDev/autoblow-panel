import { useState, useEffect, type RefObject } from 'react';

interface UseEmbedPlaybackReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  isReady: boolean;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  // Callbacks for EmbedVideoPlayer (v2-style adapter interface)
  onReady: () => void;
  onPlay: () => void;
  onPause: () => void;
  onProgress: (state: { playedSeconds: number }) => void;
  onDuration: (dur: number) => void;
  onError: (e: unknown) => void;
  onEnded: () => void;
}

interface UseEmbedPlaybackProps {
  playerRef: RefObject<HTMLVideoElement | null>;
  embedUrl: string | null;
}

/**
 * Hook to manage ReactPlayer state with the same interface as useVideoPlayback
 * Provides prop-driven playback control for embedded video platforms
 */
export function useEmbedPlayback({
  playerRef,
  embedUrl,
}: UseEmbedPlaybackProps): UseEmbedPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Reset all state when URL changes
  useEffect(() => {
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, [embedUrl]);

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const seek = (time: number) => {
    if (!isReady || !playerRef.current) return;
    playerRef.current.currentTime = time;
  };

  // ReactPlayer callback handlers
  const onReady = () => {
    setIsReady(true);
  };

  const onPlay = () => {
    setIsPlaying(true);
  };

  const onPause = () => {
    setIsPlaying(false);
  };

  const onProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds);
  };

  const onDuration = (dur: number) => {
    setDuration(dur);
  };

  const onError = (e: unknown) => {
    const errorMessage = e instanceof Error ? e.message : 'Failed to load embedded video';
    setError(errorMessage);
  };

  const onEnded = () => {
    setIsPlaying(false);
  };

  return {
    isPlaying,
    currentTime,
    duration,
    error,
    isReady,
    togglePlayPause,
    seek,
    onReady,
    onPlay,
    onPause,
    onProgress,
    onDuration,
    onError,
    onEnded,
  };
}
