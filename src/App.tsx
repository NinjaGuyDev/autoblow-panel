import { useEffect, useState, useRef } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { VideoLoader } from '@/components/file-loader/VideoLoader';
import { FunscriptLoader } from '@/components/file-loader/FunscriptLoader';
import { useVideoFile } from '@/hooks/useVideoFile';
import { useFunscriptFile } from '@/hooks/useFunscriptFile';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';

function App() {
  const [showSessionHint, setShowSessionHint] = useState(false);

  // Lifted video playback state - shared between VideoPlayer and Timeline
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    isPlaying,
    currentTime,
    duration,
    error: playbackError,
    togglePlayPause,
    seek,
  } = useVideoPlayback(videoRef);

  const {
    videoFile,
    videoUrl,
    videoName,
    loadVideo,
    clearVideo,
    error: videoError,
  } = useVideoFile();

  const {
    funscriptFile,
    funscriptData,
    funscriptName,
    loadFunscript,
    clearFunscript,
    error: funscriptError,
    isLoading,
  } = useFunscriptFile();

  const { saveSession, lastSession } = useAutoSave();

  // Handle session recovery hint on mount
  useEffect(() => {
    if (lastSession?.funscriptName) {
      setShowSessionHint(true);
    }
  }, [lastSession]);

  // Auto-save when files are loaded or changed
  useEffect(() => {
    if (funscriptData) {
      saveSession(videoName, funscriptName, funscriptData);
    }
  }, [videoName, funscriptName, funscriptData, saveSession]);

  const handleVideoLoad = (file: File) => {
    loadVideo(file);
  };

  const handleVideoClear = () => {
    clearVideo();
  };

  const handleFunscriptLoad = async (file: File) => {
    await loadFunscript(file);
  };

  const handleFunscriptClear = () => {
    clearFunscript();
  };

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen bg-background text-foreground">
        {/* Top bar */}
        <div className="border-b border-muted">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">Autoblow Panel</h1>
          </div>
        </div>

        {/* Session recovery hint */}
        {showSessionHint && lastSession?.funscriptName && (
          <div className="bg-primary/10 border-b border-primary/20">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  Previous session found: <span className="font-medium">{lastSession.funscriptName}</span>. Load files to continue.
                </p>
                <button
                  onClick={() => setShowSessionHint(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6">
            {/* Video loader - left/top, larger space */}
            <div className="bg-card border border-muted rounded-lg p-6">
              <VideoLoader
                videoFile={videoFile}
                videoUrl={videoUrl}
                videoName={videoName}
                onVideoLoad={handleVideoLoad}
                onVideoClear={handleVideoClear}
                error={videoError}
                videoRef={videoRef}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                playbackError={playbackError}
                onTogglePlayPause={togglePlayPause}
                onSeek={seek}
              />
            </div>

            {/* Funscript loader - right/bottom, smaller space */}
            <div className="bg-card border border-muted rounded-lg p-6">
              <FunscriptLoader
                funscriptFile={funscriptFile}
                funscriptData={funscriptData}
                funscriptName={funscriptName}
                onFunscriptLoad={handleFunscriptLoad}
                onFunscriptClear={handleFunscriptClear}
                error={funscriptError}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
