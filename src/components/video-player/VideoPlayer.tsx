import { useRef } from 'react';
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
