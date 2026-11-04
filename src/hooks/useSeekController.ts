/**
 * Pending-seek state for the Script Library transport bar.
 *
 * Every device seek is a network round trip, so the playhead the user steers
 * is kept locally and sent once: a slider drag previews on every move and
 * seeks on release, and a run of skips (a held arrow key, rapid clicks)
 * accumulates and seeks once the presses stop.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { type SeekDirection, skipTarget } from '@/lib/transportKeys';

/** Quiet time after the last skip before the device is asked to seek. */
const SKIP_COMMIT_DEBOUNCE_MS = 250;

interface UseSeekControllerParams {
  /** Live playhead in original script time. */
  currentTimeMs: number;
  durationMs: number;
  /** Seek the device; rejects or resolves once the device has moved. */
  onSeek: (timeMs: number) => Promise<void>;
}

interface UseSeekControllerReturn {
  /** Where the playhead should be drawn: the pending target, else live time. */
  displayTimeMs: number;
  /** True while the user is steering and the device has not caught up. */
  isSeeking: boolean;
  /** Preview a slider position without seeking. */
  scrubTo: (timeMs: number) => void;
  /** Seek to the previewed slider position. */
  commitScrub: () => void;
  /** Move the pending target and seek once skipping stops. */
  skip: (direction: SeekDirection, stepMs: number) => void;
  /** Seek straight to a position, such as a climax marker. */
  jumpTo: (timeMs: number) => void;
}

export function useSeekController({
  currentTimeMs,
  durationMs,
  onSeek,
}: UseSeekControllerParams): UseSeekControllerReturn {
  const [pendingMs, setPendingMs] = useState<number | null>(null);
  // Read synchronously by back-to-back skips that land before a re-render
  const pendingRef = useRef<number | null>(null);

  const setPending = useCallback((timeMs: number | null) => {
    pendingRef.current = timeMs;
    setPendingMs(timeMs);
  }, []);

  const clamp = useCallback(
    (timeMs: number) => Math.max(0, Math.min(timeMs, durationMs)),
    [durationMs],
  );

  const commit = useCallback(async () => {
    const target = pendingRef.current;
    if (target === null) return;
    try {
      await onSeek(target);
    } finally {
      // A newer scrub or skip that started during the round trip keeps its target
      if (pendingRef.current === target) setPending(null);
    }
  }, [onSeek, setPending]);

  const commitSoon = useDebouncedCallback(() => {
    commit().catch(err => console.error('Seek failed:', err));
  }, SKIP_COMMIT_DEBOUNCE_MS);

  // A queued seek must not fire into a script that has since been unloaded
  useEffect(() => () => commitSoon.cancel(), [commitSoon]);

  const scrubTo = useCallback((timeMs: number) => {
    commitSoon.cancel();
    setPending(clamp(timeMs));
  }, [clamp, commitSoon, setPending]);

  const commitScrub = useCallback(() => {
    commitSoon.cancel();
    commit().catch(err => console.error('Seek failed:', err));
  }, [commit, commitSoon]);

  const skip = useCallback((direction: SeekDirection, stepMs: number) => {
    const from = pendingRef.current ?? currentTimeMs;
    setPending(skipTarget(from, durationMs, direction, stepMs));
    commitSoon();
  }, [currentTimeMs, durationMs, commitSoon, setPending]);

  const jumpTo = useCallback((timeMs: number) => {
    commitSoon.cancel();
    setPending(clamp(timeMs));
    commit().catch(err => console.error('Seek failed:', err));
  }, [clamp, commit, commitSoon, setPending]);

  return {
    displayTimeMs: pendingMs ?? currentTimeMs,
    isSeeking: pendingMs !== null,
    scrubTo,
    commitScrub,
    skip,
    jumpTo,
  };
}
