import type { SyntheticEvent } from 'react';
import ReactPlayer from 'react-player';

interface EmbedVideoPlayerProps {
  url: string;
  playing: boolean;
  onReady: () => void;
  onPlay: () => void;
  onPause: () => void;
  onProgress: (state: { playedSeconds: number }) => void;
  onDuration: (duration: number) => void;
  onError: (e: unknown) => void;
  onEnded: () => void;
  playerRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Wrapper component for ReactPlayer v3 with custom configuration
 * Adapts native video element events to v2-style callbacks for useEmbedPlayback
 */
export function EmbedVideoPlayer({
  url,
  playing,
  onReady,
  onPlay,
  onPause,
  onProgress,
  onDuration,
  onError,
  onEnded,
  playerRef,
}: EmbedVideoPlayerProps) {
  const handleTimeUpdate = (e: SyntheticEvent<HTMLVideoElement>) => {
    onProgress({ playedSeconds: e.currentTarget.currentTime });
  };

  const handleDurationChange = (e: SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration;
    if (dur && isFinite(dur)) {
      onDuration(dur);
    }
  };

  return (
    <div
      className="w-full bg-black rounded-t-lg overflow-hidden"
      style={{ aspectRatio: '16/9' }}
    >
      <ReactPlayer
        ref={playerRef}
        src={url}
        playing={playing}
        controls={false}
        width="100%"
        height="100%"
        onReady={onReady}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onError={onError}
        onEnded={onEnded}
        config={{
          youtube: {
            modestbranding: 1,
          },
          vimeo: {
            byline: false,
            title: false,
          },
        }}
      />
    </div>
  );
}
