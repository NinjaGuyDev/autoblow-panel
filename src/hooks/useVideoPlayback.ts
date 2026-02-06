import { useState, useEffect, RefObject } from 'react';

interface UseVideoPlaybackReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  togglePlayPause: () => void;
  seek: (time: number) => void;
}

/**
 * Hook to manage video playback state and controls
 * Derives state from video element events (video element is source of truth)
 */
export function useVideoPlayback(
  videoRef: RefObject<HTMLVideoElement | null>
): UseVideoPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Error code to message mapping
  const errorMessages: Record<number, string> = {
    1: 'Video loading aborted',
    2: 'Network error while loading video',
    3: 'Video decoding failed',
    4: 'Video format not supported',
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Event handlers that derive state from video element
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Also update currentTime to handle seek before play
      setCurrentTime(video.currentTime);
    };
    const handleError = () => {
      const mediaError = video.error;
      if (mediaError) {
        const message = errorMessages[mediaError.code] || 'Unknown video error';
        setError(message);
      }
    };

    // Attach event listeners
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    // Initialize duration if metadata already loaded (for existing video element)
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
      setCurrentTime(video.currentTime);
    }

    // Cleanup listeners on unmount or videoRef change
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [videoRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    // Use video.paused as source of truth (not isPlaying state)
    if (video.paused) {
      video.play().catch((err) => {
        console.error('Failed to play video:', err);
      });
    } else {
      video.pause();
    }
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    // Clamp to valid range [0, duration]
    const clampedTime = Math.max(0, Math.min(time, duration));
    video.currentTime = clampedTime;
  };

  return {
    isPlaying,
    currentTime,
    duration,
    error,
    togglePlayPause,
    seek,
  };
}
