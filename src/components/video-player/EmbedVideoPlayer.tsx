import { useEffect, type SyntheticEvent } from 'react';
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
 * Wrapper component for embedded video platforms
 * Uses ReactPlayer for supported platforms (YouTube, Vimeo, etc.)
 * Falls back to iframe for unsupported platforms (Pornhub, etc.)
 */
export function EmbedVideoPlayer({
  url,
  playing: _playing,
  onReady,
  onPlay: _onPlay,
  onPause: _onPause,
  onProgress: _onProgress,
  onDuration: _onDuration,
  onError: _onError,
  onEnded: _onEnded,
  playerRef,
}: EmbedVideoPlayerProps) {
  const canPlay = ReactPlayer.canPlay(url);

  // Iframe fallback: signal ready once mounted so manual sync controls activate
  useEffect(() => {
    if (!canPlay) {
      onReady();
    }
  }, [canPlay, onReady]);

  // Iframe fallback for platforms without a JS API (Pornhub, etc.)
  // User controls playback via the embedded player's own controls.
  // Funscript sync requires manual offset adjustment.
  if (!canPlay) {
    return (
      <div
        className="w-full bg-black rounded-t-lg overflow-hidden"
        style={{ aspectRatio: '16/9' }}
      >
        <iframe
          src={url}
          width="100%"
          height="100%"
          allowFullScreen
          allow="autoplay; encrypted-media"
          style={{ border: 'none', aspectRatio: '16/9' }}
          title="Embedded video"
        />
      </div>
    );
  }

  const handleTimeUpdate = (e: SyntheticEvent<HTMLVideoElement>) => {
    _onProgress({ playedSeconds: e.currentTarget.currentTime });
  };

  const handleDurationChange = (e: SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration;
    if (dur && isFinite(dur)) {
      _onDuration(dur);
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
        playing={_playing}
        controls={false}
        width="100%"
        height="100%"
        onReady={onReady}
        onPlay={_onPlay}
        onPause={_onPause}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onError={_onError}
        onEnded={_onEnded}
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
