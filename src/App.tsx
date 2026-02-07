import { useEffect, useState, useRef } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { VideoLoader } from '@/components/file-loader/VideoLoader';
import { FunscriptLoader } from '@/components/file-loader/FunscriptLoader';
import { Timeline } from '@/components/timeline/Timeline';
import { DeviceConnection } from '@/components/device-control/DeviceConnection';
import { ManualControls } from '@/components/device-control/ManualControls';
import { useVideoFile } from '@/hooks/useVideoFile';
import { useFunscriptFile } from '@/hooks/useFunscriptFile';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import { useManualControl } from '@/hooks/useManualControl';

function App() {
  const [showSessionHint, setShowSessionHint] = useState(false);

  // Video file state - must come first as videoUrl is used by playback hook
  const {
    videoFile,
    videoUrl,
    videoName,
    loadVideo,
    clearVideo,
    error: videoError,
  } = useVideoFile();

  // Lifted video playback state - shared between VideoPlayer and Timeline
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    isPlaying,
    currentTime,
    duration,
    error: playbackError,
    togglePlayPause,
    seek,
  } = useVideoPlayback(videoRef, videoUrl);

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

  // Device connection state
  const {
    connectionState,
    error: deviceError,
    deviceInfo,
    connect,
    disconnect,
    ultra,
    savedToken,
  } = useDeviceConnection();

  // Debug: log savedToken value
  console.log('App.tsx: savedToken from hook:', savedToken);

  // Manual control state
  const {
    isRunning,
    patternType,
    speed,
    minY,
    maxY,
    increment,
    variability,
    start,
    stop,
    updateParams,
    setPatternType,
    error: manualError,
  } = useManualControl(ultra);

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

  // Helper: extract basename without extension
  const getBaseName = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  };

  // Unified file drop handler for auto-detect
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Separate files by type
    const videoExtensions = ['.mp4', '.webm', '.ogg'];
    const videoFiles = files.filter((f) =>
      videoExtensions.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    const funscriptFiles = files.filter((f) =>
      f.name.toLowerCase().endsWith('.funscript')
    );

    // Load video files
    if (videoFiles.length > 0) {
      handleVideoLoad(videoFiles[0]); // Use first video
    }

    // Load funscript files
    if (funscriptFiles.length > 0) {
      handleFunscriptLoad(funscriptFiles[0]); // Use first funscript
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <ThemeProvider defaultTheme="dark">
      <div
        className="min-h-screen bg-background text-foreground"
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
      >
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,400px)] gap-6">
            {/* Left: Video loader */}
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

            {/* Right: Funscript + Device panels stacked */}
            <div className="flex flex-col gap-6">
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

              <div className="bg-card border border-muted rounded-lg p-6">
                <DeviceConnection
                  connectionState={connectionState}
                  error={deviceError}
                  deviceInfo={deviceInfo}
                  savedToken={savedToken}
                  onConnect={connect}
                  onDisconnect={disconnect}
                />
              </div>

              <div className="bg-card border border-muted rounded-lg p-6">
                <ManualControls
                  isRunning={isRunning}
                  patternType={patternType}
                  speed={speed}
                  minY={minY}
                  maxY={maxY}
                  increment={increment}
                  variability={variability}
                  isConnected={connectionState === 'connected'}
                  onStart={start}
                  onStop={stop}
                  onParamChange={updateParams}
                  onPatternTypeChange={setPatternType}
                />
              </div>
            </div>
          </div>

          {/* Timeline - full width below loaders */}
          {funscriptData && videoUrl && (
            <div className="mt-6">
              <Timeline
                actions={funscriptData.actions}
                currentTimeMs={currentTime * 1000}
                durationMs={duration * 1000}
                isPlaying={isPlaying}
                onSeek={seek}
              />
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
