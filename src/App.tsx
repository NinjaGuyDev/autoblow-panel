import { useEffect, useState, useRef } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { DeviceProvider, useDevice } from '@/contexts/DeviceContext';
import { Layout } from '@/components/layout/Layout';
import { AppHeader } from '@/components/layout/AppHeader';
import { NavBar } from '@/components/layout/NavBar';
import { CreationFooter } from '@/components/layout/CreationFooter';
import { ScriptNameDialog } from '@/components/dialogs/ScriptNameDialog';
import { VideoSyncPage } from '@/components/pages/VideoSyncPage';
import { ManualControlPage } from '@/components/pages/ManualControlPage';
import { DeviceLogPage } from '@/components/pages/DeviceLogPage';
import { PatternLibraryPage } from '@/components/pages/PatternLibraryPage';
import { LibraryPage } from '@/components/pages/LibraryPage';
import { PlaylistPage } from '@/components/pages/PlaylistPage';
import { PlaylistControls } from '@/components/playlist/PlaylistControls';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { Timeline } from '@/components/timeline/Timeline';
import { useVideoFile } from '@/hooks/useVideoFile';
import { useFunscriptFile } from '@/hooks/useFunscriptFile';
import { useUndoableActions } from '@/hooks/useUndoableActions';
import { useMigration } from '@/hooks/useMigration';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useUnifiedPlayback } from '@/hooks/useUnifiedPlayback';
import { useManualControl } from '@/hooks/useManualControl';
import { useSyncPlayback } from '@/hooks/useSyncPlayback';
import { useLibrary } from '@/hooks/useLibrary';
import { usePlaylistManager } from '@/hooks/usePlaylistManager';
import { usePlaylistPlayback } from '@/hooks/usePlaylistPlayback';
import { useDeviceButtons } from '@/hooks/useDeviceButtons';
import { mediaApi } from '@/lib/apiClient';
import { captureVideoThumbnail } from '@/lib/thumbnailCapture';
import { exportFunscript } from '@/lib/funscriptExport';
import { insertPatternAtCursor, insertPatternAtEnd } from '@/lib/patternInsertion';
import { isEmbedUrl } from '@/lib/videoUtils';
import type { TabId } from '@/types/navigation';
import type { PatternDefinition } from '@/types/patterns';
import type { LibraryItem } from '../server/types/shared';
import type { Funscript } from '@/types/funscript';

/**
 * Thin provider shell — wraps AppContent with theme and device contexts.
 */
function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <DeviceProvider>
        <AppContent />
      </DeviceProvider>
    </ThemeProvider>
  );
}

/**
 * Main application content — orchestrates playback, editing, sync,
 * and cross-cutting coordination effects.
 */
function AppContent() {
  const [showSessionHint, setShowSessionHint] = useState(false);
  const [videoLoadHint, setVideoLoadHint] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('library');
  const [showTimeline, setShowTimeline] = useState(true);
  const [isCreationMode, setIsCreationMode] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [scriptName, setScriptName] = useState<string>('');

  // Device state from context
  const { ultra, addLog } = useDevice();

  // Library state
  const library = useLibrary();

  // Playlist state
  const playlistManager = usePlaylistManager();

  // Video file state
  const {
    videoFile,
    videoUrl,
    videoName,
    loadVideo,
    loadVideoFromUrl,
    clearVideo,
    error: videoError,
  } = useVideoFile();

  // Unified playback (local + embed)
  const videoRef = useRef<HTMLVideoElement>(null);
  const embedPlayerRef = useRef<HTMLVideoElement>(null);
  const playback = useUnifiedPlayback({ videoRef, videoUrl, videoName, embedPlayerRef });

  const {
    funscriptFile,
    funscriptData,
    funscriptName,
    loadFunscript,
    loadFunscriptFromData,
    clearFunscript,
    error: funscriptError,
    isLoading,
  } = useFunscriptFile();

  // Undoable actions state for editing
  const { actions: editableActions, setActions, undo, redo, canUndo, canRedo, reset: resetActions } = useUndoableActions(funscriptData?.actions ?? []);

  // Run migration first to ensure data is available
  useMigration();

  const { saveSession, lastSession } = useAutoSave();

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
  } = useSyncPlayback(videoRef, ultra, funscriptData, videoUrl, playback.isEmbed ? {
    isEmbed: true,
    currentTime: playback.embedPlayback.currentTime,
    isPlaying: playback.embedPlayback.isPlaying,
    manualOffsetMs: playback.manualSync.offsetMs,
  } : undefined);

  // Playlist playback state
  const playlistPlayback = usePlaylistPlayback({
    videoRef,
    loadVideoFromUrl,
    loadFunscriptFromData,
    clearVideo,
    clearFunscript,
  });

  // Device button events (pause button toggles local video play/pause)
  useDeviceButtons(ultra, videoRef, playback.isEmbed);

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
    if (isRunning && playback.activeIsPlaying) {
      if (playback.isEmbed) {
        playback.embedPlayback.togglePlayPause();
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isRunning, playback.activeIsPlaying, playback.isEmbed]);

  // Device log: Track sync status changes
  useEffect(() => {
    if (syncStatus !== 'idle') {
      addLog('info', `Sync status: ${syncStatus}`);
    }
  }, [syncStatus, addLog]);

  // Device log: Track sync errors
  useEffect(() => {
    if (syncError) {
      addLog('error', syncError);
    }
  }, [syncError, addLog]);

  const handleVideoLoad = (file: File) => {
    loadVideo(file);
    setVideoLoadHint(null);

    // Upload to media directory and capture thumbnail in background
    mediaApi.upload(file).then(() => {
      const blobUrl = URL.createObjectURL(file);
      captureVideoThumbnail(blobUrl).then(blob => {
        URL.revokeObjectURL(blobUrl);
        if (blob) {
          mediaApi.uploadThumbnail(file.name, blob).catch(err => {
            console.warn('Failed to upload thumbnail:', err);
          });
        }
      });
    }).catch(err => {
      console.warn('Failed to upload video to media directory:', err);
    });
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
    let filename: string;
    if (isCreationMode && scriptName) {
      filename = `${scriptName}.funscript`;
    } else {
      filename = funscriptName?.replace('.funscript', '-edited.funscript') ?? 'script.funscript';
    }
    exportFunscript(editableActions, filename);
  };

  // Pattern insertion handler
  const handlePatternInsert = (pattern: PatternDefinition, position: 'cursor' | 'end') => {
    if (position === 'end') {
      setActions(insertPatternAtEnd(editableActions, pattern));
    } else {
      setActions(insertPatternAtCursor(editableActions, pattern, playback.activeCurrentTime * 1000));
    }
  };

  // New script creation handler
  const handleNewScript = () => {
    setShowNameDialog(true);
  };

  // Handle script name confirmation
  const handleNameConfirm = (name: string) => {
    setScriptName(name);
    setShowNameDialog(false);
    setActions([]); // Clear existing actions
    setIsCreationMode(true);
    setActiveTab('pattern-library'); // Navigate to pattern library
  };

  // Handle script name dialog cancel
  const handleNameCancel = () => {
    setShowNameDialog(false);
  };

  // Close creation footer
  const handleCloseCreation = () => {
    setIsCreationMode(false);
    setScriptName('');
  };

  // Play playlist handler
  const handlePlayPlaylist = async (playlistId: number) => {
    await playlistPlayback.startPlaylist(playlistId);
    setActiveTab('video-sync'); // Switch to video sync tab for playback
  };

  // Handle embed URL submission
  const handleEmbedUrlLoad = (url: string) => {
    loadVideoFromUrl(url, url); // name = url for embeds
    playback.manualSync.resetOffset(); // Reset offset for new video
  };

  // Load item from library
  const handleLoadFromLibrary = async (item: LibraryItem) => {
    try {
      // Parse funscript data from JSON string
      const parsedData: Funscript = JSON.parse(item.funscriptData);

      // Load funscript data using the new loadFunscriptFromData method
      loadFunscriptFromData(item.funscriptName || 'library-item.funscript', parsedData);

      // Switch to video-sync tab
      setActiveTab('video-sync');

      // Try to load video from media directory or embed URL
      if (item.videoName) {
        if (isEmbedUrl(item.videoName)) {
          // Embed video - use URL directly, no media API check needed
          loadVideoFromUrl(item.videoName, item.videoName);
          addLog('info', `Loaded embed from library: ${item.funscriptName || item.videoName || 'Unnamed'}`);
          setVideoLoadHint(null);
        } else {
          // Local video - existing logic unchanged
          const { exists } = await mediaApi.check(item.videoName);
          if (exists) {
            loadVideoFromUrl(mediaApi.streamUrl(item.videoName), item.videoName);
            addLog('info', `Loaded from library: ${item.funscriptName || item.videoName || 'Unnamed'}`);
            setVideoLoadHint(null);
          } else {
            addLog('info', `Loaded from library: ${item.funscriptName || 'Unnamed'}`);
            setVideoLoadHint(item.videoName);
          }
        }
      } else {
        addLog('info', `Loaded from library: ${item.funscriptName || 'Unnamed'}`);
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to load library item');
      addLog('error', errorMessage);
    }
  };

  return (
    <div
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      className={isCreationMode ? 'pb-24' : ''}
    >
      <Layout
        header={
          <AppHeader
            onNewScript={handleNewScript}
            isCreationMode={isCreationMode}
          />
        }
        navbar={<NavBar activeTab={activeTab} onTabChange={setActiveTab} />}
      >
        {/* Conditional page rendering based on active tab */}
        {activeTab === 'library' && (
          <LibraryPage
            {...library}
            onLoadItem={handleLoadFromLibrary}
          />
        )}

        {activeTab === 'playlists' && (
          <PlaylistPage
            {...playlistManager}
            onPlayPlaylist={handlePlayPlaylist}
          />
        )}

        {activeTab === 'video-sync' && (
          <>
            {playlistPlayback.isPlaylistMode && (
              <PlaylistControls
                currentIndex={playlistPlayback.currentIndex}
                totalItems={playlistPlayback.totalItems}
                currentItem={playlistPlayback.currentItem}
                isFirstItem={playlistPlayback.isFirstItem}
                isLastItem={playlistPlayback.isLastItem}
                onPrevious={playlistPlayback.previousItem}
                onNext={playlistPlayback.nextItem}
                onStop={playlistPlayback.stopPlaylist}
              />
            )}
            <VideoSyncPage
              videoFile={videoFile}
              videoUrl={videoUrl}
              videoName={videoName}
              onVideoLoad={handleVideoLoad}
              onVideoClear={handleVideoClear}
              videoError={videoError}
              videoRef={videoRef}
              isPlaying={playback.activeIsPlaying}
              currentTime={playback.activeCurrentTime}
              duration={playback.activeDuration}
              playbackError={playback.activePlaybackError}
              onTogglePlayPause={playback.activeTogglePlayPause}
              onSeek={playback.activeSeek}
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
              hasFunscript={funscriptData !== null}
              showTimeline={showTimeline}
              onToggleTimeline={() => setShowTimeline(!showTimeline)}
              videoLoadHint={videoLoadHint}
              isEmbed={playback.isEmbed}
              iframeEmbed={playback.iframeEmbed}
              platformConfig={playback.platformConfig}
              onEmbedUrlSubmit={handleEmbedUrlLoad}
              embedPlayerRef={embedPlayerRef}
              embedPlaying={playback.embedPlayback.isPlaying}
              onEmbedReady={playback.embedPlayback.onReady}
              onEmbedPlay={playback.embedPlayback.onPlay}
              onEmbedPause={playback.embedPlayback.onPause}
              onEmbedProgress={playback.embedPlayback.onProgress}
              onEmbedDuration={playback.embedPlayback.onDuration}
              onEmbedError={playback.embedPlayback.onError}
              onEmbedEnded={playback.embedPlayback.onEnded}
              manualSyncOffset={playback.manualSync.offsetMs}
              onManualSyncOffsetChange={playback.manualSync.setOffsetMs}
              onManualSyncReset={playback.manualSync.resetOffset}
              manualSyncStepMs={playback.manualSync.OFFSET_STEP_MS}
              isScriptPlaying={playback.embedPlayback.isPlaying}
              onToggleScript={playback.embedPlayback.togglePlayPause}
              timelineElement={
                showTimeline && videoUrl ? (
                  <Timeline
                    actions={editableActions}
                    currentTimeMs={playback.activeCurrentTime * 1000}
                    durationMs={playback.activeDuration * 1000}
                    isPlaying={playback.activeIsPlaying}
                    onSeek={playback.activeSeek}
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
          </>
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
            isPlaying={playback.localPlayback.isPlaying}
            currentTime={playback.localPlayback.currentTime}
            duration={playback.localPlayback.duration}
            playbackError={playback.localPlayback.error}
            onTogglePlayPause={playback.localPlayback.togglePlayPause}
            onSeek={playback.localPlayback.seek}
            isRunning={isRunning}
            patternType={patternType}
            speed={speed}
            minY={minY}
            maxY={maxY}
            increment={increment}
            variability={variability}
            onStart={start}
            onStop={stop}
            onParamChange={updateParams}
            onPatternTypeChange={setPatternType}
          />
        )}

        {activeTab === 'device-log' && (
          <DeviceLogPage />
        )}

        {activeTab === 'pattern-library' && (
          <PatternLibraryPage
            onInsert={handlePatternInsert}
            isCreationMode={isCreationMode}
          />
        )}
      </Layout>

      {/* Script name dialog */}
      <ScriptNameDialog
        isOpen={showNameDialog}
        onConfirm={handleNameConfirm}
        onCancel={handleNameCancel}
      />

      {/* Creation mode footer */}
      {isCreationMode && (
        <CreationFooter
          scriptName={scriptName}
          actions={editableActions}
          onClose={handleCloseCreation}
          onExport={handleExport}
        />
      )}
    </div>
  );
}

export default App;
