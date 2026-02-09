import { VideoLoader } from '@/components/file-loader/VideoLoader';
import { ManualControls } from '@/components/device-control/ManualControls';
import { useDevice } from '@/contexts/DeviceContext';
import type { PatternType, ManualControlParams } from '@/types/device';

interface ManualControlPageProps {
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

  // Manual control props
  isRunning: boolean;
  patternType: PatternType;
  speed: number;
  minY: number;
  maxY: number;
  increment: number;
  variability: number;
  onStart: () => void;
  onStop: () => void;
  onParamChange: (params: Partial<ManualControlParams>) => void;
  onPatternTypeChange: (type: PatternType) => void;
}

/**
 * Manual Control page - two column layout with video on left, controls on right
 */
export function ManualControlPage({
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
  isRunning,
  patternType,
  speed,
  minY,
  maxY,
  increment,
  variability,
  onStart,
  onStop,
  onParamChange,
  onPatternTypeChange,
}: ManualControlPageProps) {
  const { isDeviceConnected } = useDevice();
  return (
    <div role="tabpanel" id="panel-manual-control" aria-labelledby="tab-manual-control">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left column: Video */}
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
          />
        </div>

        {/* Right column: Manual controls */}
        <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6">
          <ManualControls
            isRunning={isRunning}
            patternType={patternType}
            speed={speed}
            minY={minY}
            maxY={maxY}
            increment={increment}
            variability={variability}
            isConnected={isDeviceConnected}
            onStart={onStart}
            onStop={onStop}
            onParamChange={onParamChange}
            onPatternTypeChange={onPatternTypeChange}
          />
        </div>
      </div>
    </div>
  );
}
