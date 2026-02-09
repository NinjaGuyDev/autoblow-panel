import { useEffect, useRef } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';

/** Check this far before the expected end to account for timing drift */
const CHECK_EARLY_MS = 500;
/** If the first check is too early, retry after this interval */
const RETRY_INTERVAL_MS = 250;

/**
 * Schedules a state check near the end of each playback cycle and
 * restarts the script to create a continuous loop.
 *
 * Instead of constant polling, uses setTimeout to wait until the
 * script is ~80% complete, then checks once and restarts.
 */
export function useDemoLoop(
  ultra: Ultra | null,
  isDemoPlaying: boolean,
  scriptDurationMs: number
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ultra || !isDemoPlaying || scriptDurationMs <= 0) {
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
        const isPlaying = state.operationalMode === 'SYNC_SCRIPT_PLAYING';
        const nearEnd = state.syncScriptCurrentTime >= scriptDurationMs - CHECK_EARLY_MS;

        if (nearEnd || !isPlaying) {
          // Script finished or about to — restart
          await ultra!.syncScriptStart(0);
          // Schedule next cycle's check
          scheduleCheck(Date.now());
        } else {
          // Checked too early — retry shortly
          timerRef.current = setTimeout(checkAndRestart, RETRY_INTERVAL_MS);
        }
      } catch {
        // Device communication error — retry shortly
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
  }, [ultra, isDemoPlaying, scriptDurationMs]);
}
