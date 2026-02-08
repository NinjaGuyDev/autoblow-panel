import { formatTime } from '../../lib/format';
import { ProgressBar } from './ProgressBar';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;
  error: string | null;
}

/**
 * Custom video controls - presentation component (stateless)
 * Displays play/pause button, progress bar, and time display
 */
export function VideoControls({
  isPlaying,
  currentTime,
  duration,
  onTogglePlayPause,
  onSeek,
  error,
}: VideoControlsProps) {
  return (
    <div className="bg-card/50 rounded-b-lg">
      {error && (
        <div className="px-4 py-2 bg-destructive/20 text-destructive text-sm border-t border-destructive/30">
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlayPause}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <span className="text-lg" aria-hidden="true">
            {isPlaying ? '⏸' : '▶'}
          </span>
        </button>

        {/* Progress Bar */}
        <ProgressBar currentTime={currentTime} duration={duration} onSeek={onSeek} />

        {/* Time Display */}
        <div className="text-sm text-muted-foreground whitespace-nowrap min-w-[100px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
