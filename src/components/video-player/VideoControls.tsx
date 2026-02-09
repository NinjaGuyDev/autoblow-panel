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
    <div className="bg-stone-900/50 rounded-b-lg">
      {error && (
        <div className="px-4 py-2 bg-orange-700/20 text-orange-400 text-sm border-t border-orange-700/30">
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlayPause}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-700 text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-700/40 focus:ring-offset-2 focus:ring-offset-stone-900 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <span className="text-lg" aria-hidden="true">
            {isPlaying ? '⏸' : '▶'}
          </span>
        </button>

        {/* Progress Bar */}
        <ProgressBar currentTime={currentTime} duration={duration} onSeek={onSeek} />

        {/* Time Display */}
        <div className="text-sm text-stone-500 whitespace-nowrap min-w-[100px] text-right" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
