import { useEffect } from 'react';
import { VideoControls } from './VideoControls';

interface VideoPlayerProps {
  videoUrl: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;
}

/**
 * Main video player container with custom controls
 * Replaces native browser controls with programmatic player
 * Accepts external videoRef and playback state for sharing with timeline
 */
export function VideoPlayer({
  videoUrl,
  videoRef,
  isPlaying,
  currentTime,
  duration,
  error,
  onTogglePlayPause,
  onSeek,
}: VideoPlayerProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts when user is typing in input fields
      // EXCEPT for range inputs (progress bar) - those should allow video shortcuts
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT') {
        const inputType = (activeElement as HTMLInputElement).type;
        if (inputType !== 'range') {
          return; // Block shortcuts for text/email/etc, but allow for range
        }
      }
      if (
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.key) {
        case ' ': // Space bar
        case 'k': // Common video player shortcut
          e.preventDefault();
          onTogglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeek(currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 5));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onTogglePlayPause, onSeek, currentTime, duration]);

  return (
    <div className="rounded-lg overflow-hidden border border-muted">
      {/* Video element without native controls */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full block bg-black"
        disablePictureInPicture
      />

      {/* Custom controls */}
      <VideoControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlayPause={onTogglePlayPause}
        onSeek={onSeek}
        error={error}
      />
    </div>
  );
}
