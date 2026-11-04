/**
 * Keyboard transport for Script Library playback: Space/K toggles pause,
 * ←/J and →/L skip back and forward, Shift lengthens the skip, and [ / ]
 * jump to the previous and next recorded climax.
 *
 * Keys a focused control already handles are left alone — a prevented event
 * (the nav bar's arrow-key tab switching), text entry, and Space on anything
 * Space activates natively, such as a focused button.
 */

import { useEffect, useRef } from 'react';
import { isSpaceActivatedControl, isTypingInInput } from '@/lib/keyboardUtils';
import {
  SeekDirection,
  TransportCommand,
  skipStepMs,
  transportCommandFromKey,
} from '@/lib/transportKeys';

interface UseTransportKeysParams {
  /** Only listen while a script is loaded on the device. */
  enabled: boolean;
  onTogglePause: () => void;
  /** Move the playhead `stepMs` in `direction`; the caller owns clamping. */
  onSkip: (direction: SeekDirection, stepMs: number) => void;
  /** Jump to the nearest recorded climax in `direction`. */
  onClimaxJump: (direction: SeekDirection) => void;
}

/** True when another handler or the focused element owns this keypress. */
function isOwnedElsewhere(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  if (event.altKey || event.ctrlKey || event.metaKey) return true;
  if (isTypingInInput(event)) return true;
  return event.code === 'Space' && isSpaceActivatedControl(event);
}

export function useTransportKeys({ enabled, onTogglePause, onSkip, onClimaxJump }: UseTransportKeysParams): void {
  // Callbacks change identity with playback state; the listener reads the
  // latest through a ref so it is not torn down and re-added on every tick
  const handlersRef = useRef({ onTogglePause, onSkip, onClimaxJump });
  useEffect(() => {
    handlersRef.current = { onTogglePause, onSkip, onClimaxJump };
  }, [onTogglePause, onSkip, onClimaxJump]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOwnedElsewhere(event)) return;

      const command = transportCommandFromKey(event.code);
      if (command === null) return;

      // Space would scroll the page and arrows would scroll it sideways
      event.preventDefault();

      const handlers = handlersRef.current;
      switch (command) {
        case TransportCommand.TogglePause:
          // Holding Space must not flap the device between play and stop
          if (!event.repeat) handlers.onTogglePause();
          return;
        case TransportCommand.SkipBack:
          handlers.onSkip(SeekDirection.Back, skipStepMs(event.shiftKey));
          return;
        case TransportCommand.SkipForward:
          handlers.onSkip(SeekDirection.Forward, skipStepMs(event.shiftKey));
          return;
        case TransportCommand.PreviousClimax:
          // Each jump is an immediate seek, so key repeat would flood the device
          if (!event.repeat) handlers.onClimaxJump(SeekDirection.Back);
          return;
        case TransportCommand.NextClimax:
          if (!event.repeat) handlers.onClimaxJump(SeekDirection.Forward);
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
