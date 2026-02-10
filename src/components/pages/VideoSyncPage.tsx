import { VideoLoader } from '@/components/file-loader/VideoLoader';
import { FunscriptLoader } from '@/components/file-loader/FunscriptLoader';
import { SyncStatus } from '@/components/device-control/SyncStatus';
import { ManualSyncControls } from '@/components/video-player/ManualSyncControls';
import { useDevice } from '@/contexts/DeviceContext';
import type { Funscript } from '@/types/funscript';
import type { SyncStatus as SyncStatusType } from '@/types/sync';
import type { PlatformConfig } from '@/types/video';

interface VideoSyncPageProps {
  // Video props
  videoFile: File | null;
  videoUrl: string | null;
  videoName: string | null;
  onVideoLoad: (file: File) => void;
  onVideoClear: () => void;
  videoError: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackError: string | null;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;

  // Funscript props
  funscriptFile: File | null;
  funscriptData: Funscript | null;
  funscriptName: string | null;
  onFunscriptLoad: (file: File) => void;
  onFunscriptClear: () => void;
  funscriptError: string | null;
  isLoading: boolean;

  // Sync props
  syncStatus: SyncStatusType;
  scriptUploaded: boolean;
  driftMs: number;
  syncError: string | null;
  hasFunscript: boolean;

  // Timeline controls
  showTimeline: boolean;
  onToggleTimeline: () => void;
  timelineElement: React.ReactNode;

  // Library load hint
  videoLoadHint: string | null;

  // Embed support props
  isEmbed?: boolean;
  iframeEmbed?: boolean;
  platformConfig?: PlatformConfig;
  onEmbedUrlSubmit?: (url: string) => void;
  // Embed player callbacks (forwarded to VideoLoader -> VideoPlayer -> EmbedVideoPlayer)
  embedPlayerRef?: React.RefObject<HTMLVideoElement | null>;
  embedPlaying?: boolean;
  onEmbedReady?: () => void;
  onEmbedPlay?: () => void;
  onEmbedPause?: () => void;
  onEmbedProgress?: (state: { playedSeconds: number }) => void;
  onEmbedDuration?: (duration: number) => void;
  onEmbedError?: (e: unknown) => void;
  onEmbedEnded?: () => void;
  // Manual sync props
  manualSyncOffset?: number;
  onManualSyncOffsetChange?: (offset: number) => void;
  onManualSyncReset?: () => void;
  manualSyncStepMs?: number;
  isScriptPlaying?: boolean;
  onToggleScript?: () => void;
}

/**
 * Video Sync page - single column layout with video, funscript, and sync status
 */
export function VideoSyncPage({
  videoFile,
  videoUrl,
  videoName,
  onVideoLoad,
  onVideoClear,
  videoError,
  videoRef,
  isPlaying,
  currentTime,
  duration,
  playbackError,
  onTogglePlayPause,
  onSeek,
  funscriptFile,
  funscriptData,
  funscriptName,
  onFunscriptLoad,
  onFunscriptClear,
  funscriptError,
  isLoading,
  syncStatus,
  scriptUploaded,
  driftMs,
  syncError,
  hasFunscript,
  showTimeline,
  onToggleTimeline,
  timelineElement,
  videoLoadHint,
  isEmbed,
  iframeEmbed,
  platformConfig,
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
  manualSyncOffset,
  onManualSyncOffsetChange,
  onManualSyncReset,
  manualSyncStepMs,
  isScriptPlaying,
  onToggleScript,
}: VideoSyncPageProps) {
  const { isDeviceConnected } = useDevice();

  return (
    <div role="tabpanel" id="panel-video-sync" aria-labelledby="tab-video-sync">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Video load hint from library */}
        {videoLoadHint && !videoUrl && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400">
            Script loaded from library. Please re-select your video file: <span className="font-medium text-amber-300">{videoLoadHint}</span>
          </div>
        )}

        {/* Video section */}
        <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6">
          <VideoLoader
            videoFile={videoFile}
            videoUrl={videoUrl}
            videoName={videoName}
            onVideoLoad={onVideoLoad}
            onVideoClear={onVideoClear}
            error={videoError}
            videoRef={videoRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackError={playbackError}
            onTogglePlayPause={onTogglePlayPause}
            onSeek={onSeek}
            isEmbed={isEmbed}
            iframeEmbed={iframeEmbed}
            onEmbedUrlSubmit={onEmbedUrlSubmit}
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
        </div>

        {/* Platform info badge - show when embed is active */}
        {isEmbed && platformConfig && (
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-900/50 border border-stone-800 rounded-xl text-sm">
            <span className="text-stone-500">Source:</span>
            <span className="font-medium text-stone-200 capitalize">{platformConfig.platform.replace('-', ' ')}</span>
            <span className="text-stone-500">|</span>
            <span className="text-stone-500">Sync:</span>
            <span className={`font-medium ${platformConfig.syncMode === 'auto' ? 'text-green-400' : 'text-yellow-400'}`}>
              {platformConfig.syncMode === 'auto' ? 'Auto' : 'Manual'}
            </span>
          </div>
        )}

        {/* Manual sync controls - show when manual offset is needed */}
        {platformConfig?.requiresManualOffset && manualSyncOffset !== undefined && (
          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4">
            <ManualSyncControls
              offsetMs={manualSyncOffset}
              onOffsetChange={onManualSyncOffsetChange!}
              onReset={onManualSyncReset!}
              stepMs={manualSyncStepMs ?? 50}
              isScriptPlaying={isScriptPlaying}
              onToggleScript={onToggleScript}
            />
          </div>
        )}

        {/* Timeline section - same width as video */}
        {timelineElement && (
          <div className="bg-stone-900/50 border border-stone-800 rounded-xl">
            {timelineElement}
          </div>
        )}

        {/* Two-column layout: Funscript and Sync Status side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funscript section */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6">
            <FunscriptLoader
              funscriptFile={funscriptFile}
              funscriptData={funscriptData}
              funscriptName={funscriptName}
              onFunscriptLoad={onFunscriptLoad}
              onFunscriptClear={onFunscriptClear}
              error={funscriptError}
              isLoading={isLoading}
              showTimeline={showTimeline}
              onToggleTimeline={onToggleTimeline}
            />
          </div>

          {/* Sync status section */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6">
            <SyncStatus
              syncStatus={syncStatus}
              scriptUploaded={scriptUploaded}
              driftMs={driftMs}
              error={syncError}
              isDeviceConnected={isDeviceConnected}
              hasFunscript={hasFunscript}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
