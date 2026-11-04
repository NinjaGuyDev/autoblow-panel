/**
 * Keyboard transport mapping for Script Library playback.
 *
 * Matching is on `event.code`, like the speed-control keys, so layout and
 * modifier state never change which command a physical key sends.
 */

/** Commands the transport bar exposes to the keyboard. */
export const TransportCommand = {
  TogglePause: 'toggle-pause',
  SkipBack: 'skip-back',
  SkipForward: 'skip-forward',
  PreviousClimax: 'previous-climax',
  NextClimax: 'next-climax',
} as const;

export type TransportCommand = typeof TransportCommand[keyof typeof TransportCommand];

/** How far one skip moves the playhead, in script milliseconds. */
export const SKIP_STEP_MS = 10_000;

/**
 * The Shift-modified skip. Multi-hour scripts are tens of thousands of
 * seconds long, so 10 s steps alone would take hundreds of presses to cross.
 */
export const LONG_SKIP_STEP_MS = 60_000;

/** The skip distance for a keypress; Shift selects the long skip. */
export function skipStepMs(shiftKey: boolean): number {
  return shiftKey ? LONG_SKIP_STEP_MS : SKIP_STEP_MS;
}

const COMMAND_BY_CODE: Readonly<Record<string, TransportCommand>> = {
  Space: TransportCommand.TogglePause,
  KeyK: TransportCommand.TogglePause,
  ArrowLeft: TransportCommand.SkipBack,
  KeyJ: TransportCommand.SkipBack,
  ArrowRight: TransportCommand.SkipForward,
  KeyL: TransportCommand.SkipForward,
  BracketLeft: TransportCommand.PreviousClimax,
  BracketRight: TransportCommand.NextClimax,
};

/** Resolve a keypress to a transport command, or null when it is not one. */
export function transportCommandFromKey(code: string): TransportCommand | null {
  return COMMAND_BY_CODE[code] ?? null;
}

/** Which way a skip or marker jump moves the playhead. */
export const SeekDirection = {
  Back: -1,
  Forward: 1,
} as const;

export type SeekDirection = typeof SeekDirection[keyof typeof SeekDirection];

/** Where a skip of `stepMs` in `direction` lands, clamped to the script. */
export function skipTarget(
  currentMs: number,
  durationMs: number,
  direction: SeekDirection,
  stepMs: number,
): number {
  const target = currentMs + direction * stepMs;
  return Math.max(0, Math.min(target, durationMs));
}
