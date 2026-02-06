import { useRef, useEffect } from 'react';
import { useVideoPlayback } from '../../hooks/useVideoPlayback';
import { VideoControls } from './VideoControls';

interface VideoPlayerProps {
  videoUrl: string;
}

/**
 * Main video player container with custom controls
 * Replaces native browser controls with programmatic player
 */
export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isPlaying, currentTime, duration, error, togglePlayPause, seek } =
    useVideoPlayback(videoRef);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts when user is typing in input fields
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.key) {
        case ' ': // Space bar
        case 'k': // Common video player shortcut
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 5));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayPause, seek, currentTime, duration]);

  return (
    <div className="rounded-lg overflow-hidden border border-muted">
      {/* Video element without native controls */}
      <video ref={videoRef} src={videoUrl} className="w-full block bg-black" />

      {/* Custom controls */}
      <VideoControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlayPause={togglePlayPause}
        onSeek={seek}
        error={error}
      />
    </div>
  );
}
