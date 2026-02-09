import { useState } from 'react';
import ReactPlayer from 'react-player';
import { FileDropzone } from './FileDropzone';
import { VideoPlayer } from '../video-player/VideoPlayer';

interface VideoLoaderProps {
  videoFile: File | null;
  videoUrl: string | null;
  videoName: string | null;
  onVideoLoad: (file: File) => void;
  onVideoClear: () => void;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackError: string | null;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;
  // Embed support
  isEmbed?: boolean;
  onEmbedUrlSubmit?: (url: string) => void;
  embedPlayerRef?: React.RefObject<ReactPlayer | null>;
  embedPlaying?: boolean;
  onEmbedReady?: () => void;
  onEmbedPlay?: () => void;
  onEmbedPause?: () => void;
  onEmbedProgress?: (state: { playedSeconds: number }) => void;
  onEmbedDuration?: (duration: number) => void;
  onEmbedError?: (e: unknown) => void;
  onEmbedEnded?: () => void;
}

export function VideoLoader({
  videoFile: _videoFile,
  videoUrl,
  videoName: _videoName,
  onVideoLoad,
  onVideoClear,
  error,
  videoRef,
  isPlaying,
  currentTime,
  duration,
  playbackError,
  onTogglePlayPause,
  onSeek,
  isEmbed = false,
  onEmbedUrlSubmit,
  embedPlayerRef,
  embedPlaying,
  onEmbedReady,
  onEmbedPlay,
  onEmbedPause,
  onEmbedProgress,
  onEmbedDuration,
  onEmbedError,
  onEmbedEnded,
}: VideoLoaderProps) {
  const [urlInput, setUrlInput] = useState('');

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return; // Invalid URL
    }
    onEmbedUrlSubmit?.(url);
    setUrlInput('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Video</h2>
        {videoUrl && (
          <button
            onClick={onVideoClear}
            className="px-3 py-1 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {!videoUrl ? (
        <>
          <FileDropzone
            onFileAccepted={onVideoLoad}
            accept={{ 'video/*': ['.mp4', '.webm', '.ogg', '.mkv'] }}
            label="Load Video"
            description="MP4, WebM, OGG, or MKV"
            error={error}
          />

          {/* URL input section */}
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground uppercase">or paste URL</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
            >
              Load
            </button>
          </form>
        </>
      ) : (
        <VideoPlayer
          videoUrl={videoUrl!}
          videoRef={videoRef}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          error={playbackError}
          onTogglePlayPause={onTogglePlayPause}
          onSeek={onSeek}
          isEmbed={isEmbed}
          embedPlayerRef={embedPlayerRef}
          embedPlaying={embedPlaying}
          onEmbedReady={onEmbedReady}
          onEmbedPlay={onEmbedPlay}
          onEmbedPause={onEmbedPause}
          onEmbedProgress={onEmbedProgress}
          onEmbedDuration={onEmbedDuration}
          onEmbedError={onEmbedError}
          onEmbedEnded={onEmbedEnded}
        />
      )}
    </div>
  );
}
