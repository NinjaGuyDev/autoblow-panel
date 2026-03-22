import { VideoLoader } from '@/components/file-loader/VideoLoader';
import { FunscriptLoader } from '@/components/file-loader/FunscriptLoader';
import { SyncStatus } from '@/components/device-control/SyncStatus';
import { ManualSyncControls } from '@/components/video-player/ManualSyncControls';
import { useDevice } from '@/contexts/DeviceContext';
import type { Funscript } from '@/types/funscript';
import type { SyncStatus as SyncStatusType } from '@/types/sync';
import type { PlatformConfig } from '@/types/video';

/** Video file state and playback controls */
export interface VideoProps {
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
}

/** Funscript file state and loading controls */
export interface FunscriptProps {
  funscriptFile: File | null;
  funscriptData: Funscript | null;
  funscriptName: string | null;
  onFunscriptLoad: (file: File) => void;
  onFunscriptClear: () => void;
  funscriptError: string | null;
  isLoading: boolean;
}

/** Device sync state (read-only status display) */
export interface SyncProps {
  syncStatus: SyncStatusType;
  scriptUploaded: boolean;
  driftMs: number;
  syncError: string | null;
  hasFunscript: boolean;
}

/** Embed player callbacks forwarded to VideoLoader -> VideoPlayer -> EmbedVideoPlayer */
export interface EmbedProps {
  isEmbed?: boolean;
  iframeEmbed?: boolean;
  platformConfig?: PlatformConfig;
  onEmbedUrlSubmit?: (url: string) => void;
  embedPlayerRef?: React.RefObject<HTMLVideoElement | null>;
  embedPlaying?: boolean;
  onEmbedReady?: () => void;
  onEmbedPlay?: () => void;
  onEmbedPause?: () => void;
  onEmbedProgress?: (state: { playedSeconds: number }) => void;
  onEmbedDuration?: (duration: number) => void;
  onEmbedError?: (e: unknown) => void;
  onEmbedEnded?: () => void;
}

/** Manual sync offset controls for embed platforms without auto-sync */
export interface ManualSyncProps {
  manualSyncOffset?: number;
  onManualSyncOffsetChange: (offset: number) => void;
  onManualSyncReset: () => void;
  manualSyncStepMs?: number;
  isScriptPlaying?: boolean;
  onToggleScript?: () => void;
}

interface VideoSyncPageProps {
  video: VideoProps;
  funscript: FunscriptProps;
  sync: SyncProps;
  embed: EmbedProps;
  manualSync: ManualSyncProps;
  showTimeline: boolean;
  onToggleTimeline: () => void;
  timelineElement: React.ReactNode;
  videoLoadHint: string | null;
}

/**
 * Video Sync page - single column layout with video, funscript, and sync status
 */
export function VideoSyncPage({
  video,
  funscript,
  sync,
  embed,
  manualSync,
  showTimeline,
  onToggleTimeline,
  timelineElement,
  videoLoadHint,
}: VideoSyncPageProps) {
  const { isDeviceConnected } = useDevice();

  return (
    <div role="tabpanel" id="panel-video-sync" aria-labelledby="tab-video-sync">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Video load hint from library */}
        {videoLoadHint && !video.videoUrl && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400">
            Script loaded from library. Please re-select your video file: <span className="font-medium text-amber-300">{videoLoadHint}</span>
          </div>
        )}

        {/* Video section */}
        <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6">
          <VideoLoader
            videoFile={video.videoFile}
            videoUrl={video.videoUrl}
            videoName={video.videoName}
            onVideoLoad={video.onVideoLoad}
            onVideoClear={video.onVideoClear}
            error={video.videoError}
            videoRef={video.videoRef}
            isPlaying={video.isPlaying}
            currentTime={video.currentTime}
            duration={video.duration}
            playbackError={video.playbackError}
            onTogglePlayPause={video.onTogglePlayPause}
            onSeek={video.onSeek}
            isEmbed={embed.isEmbed}
            iframeEmbed={embed.iframeEmbed}
            onEmbedUrlSubmit={embed.onEmbedUrlSubmit}
            embedPlayerRef={embed.embedPlayerRef}
            embedPlaying={embed.embedPlaying}
            onEmbedReady={embed.onEmbedReady}
            onEmbedPlay={embed.onEmbedPlay}
            onEmbedPause={embed.onEmbedPause}
            onEmbedProgress={embed.onEmbedProgress}
            onEmbedDuration={embed.onEmbedDuration}
            onEmbedError={embed.onEmbedError}
            onEmbedEnded={embed.onEmbedEnded}
          />
        </div>

        {/* Platform info badge - show when embed is active */}
        {embed.isEmbed && embed.platformConfig && (
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-900/50 border border-stone-800 rounded-xl text-sm">
            <span className="text-stone-500">Source:</span>
            <span className="font-medium text-stone-200 capitalize">{embed.platformConfig.platform.replace('-', ' ')}</span>
            <span className="text-stone-500">|</span>
            <span className="text-stone-500">Sync:</span>
            <span className={`font-medium ${embed.platformConfig.syncMode === 'auto' ? 'text-green-400' : 'text-yellow-400'}`}>
              {embed.platformConfig.syncMode === 'auto' ? 'Auto' : 'Manual'}
            </span>
          </div>
        )}

        {/* Manual sync controls - show when manual offset is needed */}
        {embed.platformConfig?.requiresManualOffset && manualSync.manualSyncOffset !== undefined && (
          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4">
            <ManualSyncControls
              offsetMs={manualSync.manualSyncOffset}
              onOffsetChange={manualSync.onManualSyncOffsetChange}
              onReset={manualSync.onManualSyncReset}
              stepMs={manualSync.manualSyncStepMs ?? 50}
              isScriptPlaying={manualSync.isScriptPlaying}
              onToggleScript={manualSync.onToggleScript}
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
              funscriptFile={funscript.funscriptFile}
              funscriptData={funscript.funscriptData}
              funscriptName={funscript.funscriptName}
              onFunscriptLoad={funscript.onFunscriptLoad}
              onFunscriptClear={funscript.onFunscriptClear}
              error={funscript.funscriptError}
              isLoading={funscript.isLoading}
              showTimeline={showTimeline}
              onToggleTimeline={onToggleTimeline}
            />
          </div>

          {/* Sync status section */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6">
            <SyncStatus
              syncStatus={sync.syncStatus}
              scriptUploaded={sync.scriptUploaded}
              driftMs={sync.driftMs}
              error={sync.syncError}
              isDeviceConnected={isDeviceConnected}
              hasFunscript={sync.hasFunscript}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
