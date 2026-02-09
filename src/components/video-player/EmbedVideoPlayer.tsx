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
  playerRef: React.RefObject<ReactPlayer | null>;
}

/**
 * Wrapper component for ReactPlayer with custom configuration
 * Provides consistent API for embedded video platforms (YouTube, Vimeo, etc.)
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
  return (
    <div
      className="w-full bg-black rounded-t-lg overflow-hidden"
      style={{ aspectRatio: '16/9' }}
    >
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing={playing}
        controls={false}
        width="100%"
        height="100%"
        style={{ aspectRatio: '16/9' }}
        progressInterval={250}
        onReady={onReady}
        onPlay={onPlay}
        onPause={onPause}
        onProgress={onProgress}
        onDuration={onDuration}
        onError={onError}
        onEnded={onEnded}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
            },
          },
          vimeo: {
            playerOptions: {
              byline: false,
              title: false,
            },
          },
        }}
      />
    </div>
  );
}
