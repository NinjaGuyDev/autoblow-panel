import { useState } from 'react';
import { formatTime } from '@/lib/format';

interface SeekSliderProps {
  valueMs: number;
  durationMs: number;
  disabled: boolean;
  /** Fired on every drag or keyboard move — preview only. */
  onScrub: (timeMs: number) => void;
  /** Fired when the drag or key press ends — this is the one that seeks. */
  onCommit: () => void;
  /** Recorded climax positions to mark on the track, ascending. */
  climaxMarkersMs: readonly number[];
  /** Fired when a climax marker is clicked. */
  onMarkerSelect: (timeMs: number) => void;
}

/** Slider resolution; finer than a pixel even on a short script. */
const STEP_MS = 100;

/** Matches the `w-4` thumb below; the browser insets the track by half of it. */
const THUMB_WIDTH_PX = 16;

/** Keys the native range input moves on; their release commits the seek. */
const SLIDER_MOVE_KEYS = new Set(['Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown']);

/** CSS `left` for a point `ratio` along the thumb-inset track. */
function trackLeft(ratio: number): string {
  return `calc(${THUMB_WIDTH_PX / 2}px + ${ratio} * (100% - ${THUMB_WIDTH_PX}px))`;
}

/** Map a pointer x position to script time over the thumb-inset track. */
function timeAtPointer(event: React.PointerEvent<HTMLInputElement>, durationMs: number): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const trackWidth = rect.width - THUMB_WIDTH_PX;
  if (trackWidth <= 0) return 0;
  const ratio = (event.clientX - rect.left - THUMB_WIDTH_PX / 2) / trackWidth;
  return Math.max(0, Math.min(ratio, 1)) * durationMs;
}

/**
 * Scrubbable script position. A native range input keeps keyboard, touch and
 * screen-reader support; a hover readout shows the time under the pointer,
 * which on a multi-hour script is the only way to aim a drag — one pixel of
 * track there spans many seconds.
 */
export function SeekSlider({
  valueMs,
  durationMs,
  disabled,
  onScrub,
  onCommit,
  climaxMarkersMs,
  onMarkerSelect,
}: SeekSliderProps) {
  const [hover, setHover] = useState<{ timeMs: number; ratio: number } | null>(null);
  const progress = durationMs > 0 ? (valueMs / durationMs) * 100 : 0;

  const handlePointerMove = (event: React.PointerEvent<HTMLInputElement>) => {
    if (durationMs <= 0) return;
    const timeMs = timeAtPointer(event, durationMs);
    setHover({ timeMs, ratio: timeMs / durationMs });
  };

  // ←/→ never reach the native step: the window-level transport shortcut
  // prevents their default, which the browser applies only after bubbling
  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (SLIDER_MOVE_KEYS.has(event.key)) onCommit();
  };

  return (
    <div className="relative flex-1 min-w-0">
      {hover && !disabled && (
        <div
          className="pointer-events-none absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded bg-stone-800 text-xs text-stone-200 whitespace-nowrap"
          style={{ left: trackLeft(hover.ratio), fontFamily: 'var(--font-mono)' }}
          aria-hidden="true"
        >
          {formatTime(hover.timeMs / 1000)}
        </div>
      )}
      {durationMs > 0 && climaxMarkersMs.map(markerMs => {
        const label = `Jump to climax at ${formatTime(markerMs / 1000)}`;
        return (
          // Out of the tab order: [ and ] and the prev/next buttons reach the
          // same markers without a tab stop per record
          <button
            key={markerMs}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => onMarkerSelect(markerMs)}
            className="absolute bottom-full mb-1 -translate-x-1/2 w-2 h-2.5 rounded-sm bg-rose-500 hover:bg-rose-400 disabled:cursor-not-allowed"
            style={{ left: trackLeft(Math.min(markerMs / durationMs, 1)) }}
            aria-label={label}
            title={label}
          />
        );
      })}
      <input
        type="range"
        min={0}
        max={durationMs}
        step={STEP_MS}
        value={Math.min(valueMs, durationMs)}
        disabled={disabled}
        onChange={(e) => onScrub(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={handleKeyUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
        aria-label="Script position"
        aria-valuetext={`${formatTime(valueMs / 1000)} of ${formatTime(durationMs / 1000)}`}
        style={{
          background: `linear-gradient(to right, rgb(217 119 6) 0%, rgb(217 119 6) ${progress}%, rgb(41 37 36) ${progress}%, rgb(41 37 36) 100%)`,
        }}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/40 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:hover:bg-amber-400 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:hover:bg-amber-400"
      />
    </div>
  );
}
