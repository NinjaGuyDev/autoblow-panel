import { Pause, Play, Rewind, FastForward, Square, SkipBack, SkipForward } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { LONG_SKIP_STEP_MS, SKIP_STEP_MS, SeekDirection, skipStepMs } from '@/lib/transportKeys';
import { SeekSlider } from '@/components/script-library/SeekSlider';

interface ScriptTransportBarProps {
  title: string;
  isPaused: boolean;
  disabled: boolean;
  displayTimeMs: number;
  durationMs: number;
  onTogglePause: () => void;
  onSkip: (direction: SeekDirection, stepMs: number) => void;
  onScrub: (timeMs: number) => void;
  onCommitScrub: () => void;
  onStop: () => void;
  /** Recorded climax positions for this script, ascending. */
  climaxMarkersMs: readonly number[];
  hasPreviousClimax: boolean;
  hasNextClimax: boolean;
  onClimaxJump: (direction: SeekDirection) => void;
  onJumpTo: (timeMs: number) => void;
}

const SKIP_SECONDS = SKIP_STEP_MS / 1000;
const LONG_SKIP_SECONDS = LONG_SKIP_STEP_MS / 1000;

const ROUND_BUTTON =
  'flex items-center justify-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/40 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900';

/**
 * Play/pause, skip, scrub and stop for the script on the device.
 * Presentation only; ScriptTransport owns seek state and keyboard shortcuts.
 */
export function ScriptTransportBar({
  title,
  isPaused,
  disabled,
  displayTimeMs,
  durationMs,
  onTogglePause,
  onSkip,
  onScrub,
  onCommitScrub,
  onStop,
  climaxMarkersMs,
  hasPreviousClimax,
  hasNextClimax,
  onClimaxJump,
  onJumpTo,
}: ScriptTransportBarProps) {
  const climaxButton = (direction: SeekDirection) => {
    const isBack = direction === SeekDirection.Back;
    const Icon = isBack ? SkipBack : SkipForward;
    const label = `${isBack ? 'Previous' : 'Next'} recorded climax`;
    const available = isBack ? hasPreviousClimax : hasNextClimax;
    return (
      <button
        type="button"
        onClick={() => onClimaxJump(direction)}
        disabled={disabled || !available}
        className={`${ROUND_BUTTON} w-9 h-9 text-rose-400 hover:text-rose-300 hover:bg-stone-800`}
        aria-label={label}
        title={`${label} (${isBack ? '[' : ']'})`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };
  const skipButton = (direction: SeekDirection) => {
    const isBack = direction === SeekDirection.Back;
    const Icon = isBack ? Rewind : FastForward;
    const label = `${isBack ? 'Back' : 'Forward'} ${SKIP_SECONDS} seconds`;
    return (
      <button
        type="button"
        onClick={(e) => onSkip(direction, skipStepMs(e.shiftKey))}
        disabled={disabled}
        className={`${ROUND_BUTTON} w-9 h-9 text-stone-300 hover:text-stone-100 hover:bg-stone-800`}
        aria-label={label}
        title={`${label} (${isBack ? '←' : '→'}; Shift for ${LONG_SKIP_SECONDS} seconds)`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-amber-400" title={title}>{title}</span>
        <span className="text-stone-500 whitespace-nowrap hidden sm:inline">
          Space play/pause · ←/→ {SKIP_SECONDS}s · Shift+←/→ {LONG_SKIP_SECONDS}s
          {climaxMarkersMs.length > 0 && ' · [ / ] climax'}
        </span>
      </div>
      {/* The slider gets a full-width row: on a multi-hour script every
          pixel of track is seconds of script, so width is precision */}
      <div className="flex items-center gap-3 pt-3">
        <span className="text-sm text-stone-300 whitespace-nowrap tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatTime(displayTimeMs / 1000)}
        </span>
        <SeekSlider
          valueMs={displayTimeMs}
          durationMs={durationMs}
          disabled={disabled}
          onScrub={onScrub}
          onCommit={onCommitScrub}
          climaxMarkersMs={climaxMarkersMs}
          onMarkerSelect={onJumpTo}
        />
        <span className="text-sm text-stone-500 whitespace-nowrap tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatTime(durationMs / 1000)}
        </span>
      </div>
      <div className="relative flex items-center justify-center gap-2 sm:gap-3">
        {climaxMarkersMs.length > 0 && climaxButton(SeekDirection.Back)}
        {skipButton(SeekDirection.Back)}
        <button
          type="button"
          onClick={onTogglePause}
          disabled={disabled}
          className={`${ROUND_BUTTON} w-11 h-11 bg-amber-700 text-white hover:bg-amber-600`}
          aria-label={isPaused ? 'Resume' : 'Pause'}
          title={`${isPaused ? 'Resume' : 'Pause'} (Space)`}
        >
          {isPaused ? <Play className="w-5 h-5 translate-x-px" /> : <Pause className="w-5 h-5" />}
        </button>
        {skipButton(SeekDirection.Forward)}
        {climaxMarkersMs.length > 0 && climaxButton(SeekDirection.Forward)}

        <button
          type="button"
          onClick={onStop}
          disabled={disabled}
          className={`${ROUND_BUTTON} absolute right-0 w-9 h-9 text-orange-400 hover:text-white hover:bg-orange-700`}
          aria-label="Stop playback"
          title="Stop playback"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
