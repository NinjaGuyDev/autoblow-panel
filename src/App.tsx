import { useEffect, useState, useRef } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Layout } from '@/components/layout/Layout';
import { AppHeader } from '@/components/layout/AppHeader';
import { NavBar } from '@/components/layout/NavBar';
import { CreationFooter } from '@/components/layout/CreationFooter';
import { VideoSyncPage } from '@/components/pages/VideoSyncPage';
import { ManualControlPage } from '@/components/pages/ManualControlPage';
import { DeviceLogPage } from '@/components/pages/DeviceLogPage';
import { PatternLibraryPage } from '@/components/pages/PatternLibraryPage';
import { Timeline } from '@/components/timeline/Timeline';
import { useVideoFile } from '@/hooks/useVideoFile';
import { useFunscriptFile } from '@/hooks/useFunscriptFile';
import { useUndoableActions } from '@/hooks/useUndoableActions';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import { useManualControl } from '@/hooks/useManualControl';
import { useSyncPlayback } from '@/hooks/useSyncPlayback';
import { useDeviceLog } from '@/hooks/useDeviceLog';
import { exportFunscript } from '@/lib/funscriptExport';
import { insertPatternAtCursor, insertPatternAtEnd } from '@/lib/patternInsertion';
import type { TabId } from '@/types/navigation';
import type { PatternDefinition } from '@/types/patterns';

function App() {
  const [showSessionHint, setShowSessionHint] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('video-sync');
  const [showTimeline, setShowTimeline] = useState(true);
  const [isCreationMode, setIsCreationMode] = useState(false);
  const { logs, addLog, clearLogs } = useDeviceLog();

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

  // Undoable actions state for editing
  const { actions: editableActions, setActions, undo, redo, canUndo, canRedo, reset: resetActions } = useUndoableActions(funscriptData?.actions ?? []);

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
  } = useManualControl(ultra);

  // Sync playback state
  const {
    syncStatus,
    scriptUploaded,
    driftMs,
    error: syncError,
  } = useSyncPlayback(videoRef, ultra, funscriptData, videoUrl);

  // Handle session recovery hint on mount
  useEffect(() => {
    if (lastSession?.funscriptName) {
      setShowSessionHint(true);
    }
  }, [lastSession]);

  // Sync loaded funscript into undoable state
  useEffect(() => {
    if (funscriptData) {
      resetActions(funscriptData.actions);
    }
  }, [funscriptData, resetActions]);

  // Auto-save when files are loaded or changed (save editableActions)
  useEffect(() => {
    if (funscriptData && editableActions) {
      const editedFunscript = { ...funscriptData, actions: editableActions };
      saveSession(videoName, funscriptName, editedFunscript);
    }
  }, [videoName, funscriptName, funscriptData, editableActions, saveSession]);

  // Mutual exclusion: Stop manual control when sync playback starts
  useEffect(() => {
    if (syncStatus === 'playing' && isRunning) {
      stop();
    }
  }, [syncStatus, isRunning, stop]);

  // Mutual exclusion: Pause video when manual control starts during playback
  useEffect(() => {
    if (isRunning && isPlaying && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isRunning, isPlaying]);

  // Device log integration: Track connection state changes
  const prevConnectionStateRef = useRef<typeof connectionState>('disconnected');
  useEffect(() => {
    if (connectionState === 'connected' && prevConnectionStateRef.current !== 'connected') {
      addLog('info', 'Device connected');
    } else if (connectionState === 'disconnected' && prevConnectionStateRef.current === 'connected') {
      addLog('info', 'Device disconnected');
    }
    prevConnectionStateRef.current = connectionState;
  }, [connectionState, addLog]);

  // Device log integration: Track device errors
  useEffect(() => {
    if (deviceError) {
      addLog('error', deviceError);
    }
  }, [deviceError, addLog]);

  // Device log integration: Track sync status changes
  useEffect(() => {
    if (syncStatus !== 'idle') {
      addLog('info', `Sync status: ${syncStatus}`);
    }
  }, [syncStatus, addLog]);

  // Device log integration: Track sync errors
  useEffect(() => {
    if (syncError) {
      addLog('error', syncError);
    }
  }, [syncError, addLog]);

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

  // Export handler
  const handleExport = () => {
    const filename = funscriptName?.replace('.funscript', '-edited.funscript') ?? 'script.funscript';
    exportFunscript(editableActions, filename);
  };

  // Pattern insertion handler
  const handlePatternInsert = (pattern: PatternDefinition, position: 'cursor' | 'end') => {
    if (position === 'end') {
      setActions(insertPatternAtEnd(editableActions, pattern));
    } else {
      setActions(insertPatternAtCursor(editableActions, pattern, currentTime * 1000));
    }
  };

  // New script creation handler
  const handleNewScript = () => {
    setActions([]); // Clear existing actions
    setIsCreationMode(true);
    setActiveTab('pattern-library'); // Navigate to pattern library
  };

  // Close creation footer
  const handleCloseCreation = () => {
    setIsCreationMode(false);
  };

  return (
    <ThemeProvider defaultTheme="dark">
      <div
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        className={isCreationMode ? 'pb-24' : ''}
      >
        <Layout
          header={
            <AppHeader
              connectionState={connectionState}
              deviceInfo={deviceInfo}
              error={deviceError}
              savedToken={savedToken}
              onConnect={connect}
              onDisconnect={disconnect}
              onNewScript={handleNewScript}
              isCreationMode={isCreationMode}
            />
          }
          navbar={<NavBar activeTab={activeTab} onTabChange={setActiveTab} />}
        >
          {/* Conditional page rendering based on active tab */}
          {activeTab === 'video-sync' && (
            <VideoSyncPage
              videoFile={videoFile}
              videoUrl={videoUrl}
              videoName={videoName}
              onVideoLoad={handleVideoLoad}
              onVideoClear={handleVideoClear}
              videoError={videoError}
              videoRef={videoRef}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              playbackError={playbackError}
              onTogglePlayPause={togglePlayPause}
              onSeek={seek}
              funscriptFile={funscriptFile}
              funscriptData={funscriptData}
              funscriptName={funscriptName}
              onFunscriptLoad={handleFunscriptLoad}
              onFunscriptClear={handleFunscriptClear}
              funscriptError={funscriptError}
              isLoading={isLoading}
              syncStatus={syncStatus}
              scriptUploaded={scriptUploaded}
              driftMs={driftMs}
              syncError={syncError}
              isDeviceConnected={connectionState === 'connected'}
              hasFunscript={funscriptData !== null}
              showTimeline={showTimeline}
              onToggleTimeline={() => setShowTimeline(!showTimeline)}
              timelineElement={
                showTimeline && videoUrl ? (
                  <Timeline
                    actions={editableActions}
                    currentTimeMs={currentTime * 1000}
                    durationMs={duration * 1000}
                    isPlaying={isPlaying}
                    onSeek={seek}
                    onActionsChange={setActions}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onExport={handleExport}
                  />
                ) : null
              }
            />
          )}

          {activeTab === 'manual-control' && (
            <ManualControlPage
              videoFile={videoFile}
              videoUrl={videoUrl}
              videoName={videoName}
              onVideoLoad={handleVideoLoad}
              onVideoClear={handleVideoClear}
              videoError={videoError}
              videoRef={videoRef}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              playbackError={playbackError}
              onTogglePlayPause={togglePlayPause}
              onSeek={seek}
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
          )}

          {activeTab === 'device-log' && (
            <DeviceLogPage logs={logs} onClearLogs={clearLogs} />
          )}

          {activeTab === 'pattern-library' && (
            <PatternLibraryPage
              onInsert={handlePatternInsert}
              isCreationMode={isCreationMode}
            />
          )}
        </Layout>

        {/* Creation mode footer */}
        {isCreationMode && (
          <CreationFooter
            actions={editableActions}
            onClose={handleCloseCreation}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
