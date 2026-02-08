import { VideoLoader } from '@/components/file-loader/VideoLoader';
import { FunscriptLoader } from '@/components/file-loader/FunscriptLoader';
import { SyncStatus } from '@/components/device-control/SyncStatus';
import type { ZodFunscript } from '@/lib/schemas';
import type { SyncStatus as SyncStatusType } from '@/types/sync';

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
  funscriptData: ZodFunscript | null;
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
  isDeviceConnected: boolean;
  hasFunscript: boolean;

  // Timeline controls
  showTimeline: boolean;
  onToggleTimeline: () => void;
  timelineElement: React.ReactNode;

  // Library load hint
  videoLoadHint: string | null;
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
  isDeviceConnected,
  hasFunscript,
  showTimeline,
  onToggleTimeline,
  timelineElement,
  videoLoadHint,
}: VideoSyncPageProps) {
  return (
    <div role="tabpanel" id="panel-video-sync" aria-labelledby="tab-video-sync">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Video load hint from library */}
        {videoLoadHint && !videoUrl && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 text-sm text-blue-400">
            Script loaded from library. Please re-select your video file: <span className="font-medium text-blue-300">{videoLoadHint}</span>
          </div>
        )}

        {/* Video section */}
        <div className="bg-card border border-muted rounded-lg p-6">
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
          />
        </div>

        {/* Timeline section - same width as video */}
        {timelineElement && (
          <div className="bg-card border border-muted rounded-lg">
            {timelineElement}
          </div>
        )}

        {/* Two-column layout: Funscript and Sync Status side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funscript section */}
          <div className="bg-card border border-muted rounded-lg p-6">
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
          <div className="bg-card border border-muted rounded-lg p-6">
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
