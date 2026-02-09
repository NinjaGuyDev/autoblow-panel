/**
 * Generalized loop detection hook with callback.
 * Schedules a state check near the end of each playback cycle and
 * invokes onLoopEnd when the script finishes (or is about to).
 *
 * Follows OCP: useDemoLoop stays untouched; this variant takes
 * an arbitrary callback instead of hardcoding syncScriptStart(0).
 */

import { useEffect, useRef } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';

const CHECK_EARLY_MS = 500;
const RETRY_INTERVAL_MS = 250;

export function useScriptLoop(
  ultra: Ultra | null,
  isPlaying: boolean,
  scriptDurationMs: number,
  onLoopEnd: () => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoopEndRef = useRef(onLoopEnd);

  // Keep callback ref fresh without re-triggering the effect
  useEffect(() => {
    onLoopEndRef.current = onLoopEnd;
  }, [onLoopEnd]);

  useEffect(() => {
    if (!ultra || !isPlaying || scriptDurationMs <= 0) {
      return;
    }

    let cancelled = false;
    const loopStartTime = Date.now();

    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function checkAndRestart() {
      if (cancelled) return;

      try {
        const state = await ultra!.getState();
        const playing = state.operationalMode === 'SYNC_SCRIPT_PLAYING';
        const nearEnd = state.syncScriptCurrentTime >= scriptDurationMs - CHECK_EARLY_MS;

        if (nearEnd || !playing) {
          onLoopEndRef.current();
          scheduleCheck(Date.now());
        } else {
          timerRef.current = setTimeout(checkAndRestart, RETRY_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) {
          timerRef.current = setTimeout(checkAndRestart, RETRY_INTERVAL_MS);
        }
      }
    }

    function scheduleCheck(cycleStart: number) {
      if (cancelled) return;
      const elapsed = Date.now() - cycleStart;
      const waitMs = Math.max(0, scriptDurationMs - CHECK_EARLY_MS - elapsed);
      timerRef.current = setTimeout(checkAndRestart, waitMs);
    }

    scheduleCheck(loopStartTime);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [ultra, isPlaying, scriptDurationMs]);
}
