import { useState, useCallback, useRef, useEffect } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { RandomizedScript } from '@/types/randomizer';
import { mediaApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';

const POSITION_POLL_MS = 200;
/** Stop polling after this many consecutive device errors */
const MAX_POLL_FAILURES = 10;

interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTimeMs: number;
  currentSegmentIndex: number;
  error: string | null;
  isComplete: boolean;
}

export function useRandomizerPlayback(
  ultra: Ultra | null,
  script: RandomizedScript | null,
) {
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentTimeMs: 0,
    currentSegmentIndex: -1,
    error: null,
    isComplete: false,
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSegRef = useRef(-1);
  /** Tracks which audioTimeline cues have already been triggered this playback */
  const triggeredCuesRef = useRef<Set<number>>(new Set());
  /** Mutable ref for current position — used by togglePause to avoid stale closure */
  const currentTimeMsRef = useRef(0);
  /** Consecutive poll failure counter */
  const pollFailureCountRef = useRef(0);
  /** Whether the hook is currently paused (mutable for poll access) */
  const isPausedRef = useRef(false);
  /** Whether polling is active — prevents scheduling after stop */
  const isPollingActiveRef = useRef(false);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingActiveRef.current = false;
  }, []);

  /** Self-scheduling poll tick — avoids overlapping async calls */
  const schedulePollTick = useCallback((ultraRef: Ultra, scriptRef: RandomizedScript) => {
    if (!isPollingActiveRef.current) return;

    pollTimerRef.current = setTimeout(async () => {
      if (!isPollingActiveRef.current) return;

      try {
        const deviceState = await ultraRef.getState();
        if (!isPollingActiveRef.current) return; // Stopped during await

        pollFailureCountRef.current = 0;

        const timeMs = deviceState.syncScriptCurrentTime ?? 0;
        const isDevicePlaying = deviceState.operationalMode === 'SYNC_SCRIPT_PLAYING';

        currentTimeMsRef.current = timeMs;

        let segIdx = -1;
        if (scriptRef.segments.length > 0) {
          for (let i = scriptRef.segments.length - 1; i >= 0; i--) {
            if (timeMs >= scriptRef.segments[i].startMs) {
              segIdx = i;
              break;
            }
          }
        }

        // Audio triggering: audioTimeline takes priority over segment-based audio
        if (scriptRef.audioTimeline && scriptRef.audioTimeline.length > 0) {
          for (let ci = 0; ci < scriptRef.audioTimeline.length; ci++) {
            const cue = scriptRef.audioTimeline[ci];
            if (timeMs >= cue.startMs && !triggeredCuesRef.current.has(ci)) {
              triggeredCuesRef.current.add(ci);
              cleanupAudio();
              const audio = new Audio(mediaApi.streamUrl(cue.audioFile));
              audio.play().catch(() => {});
              audioRef.current = audio;
              break;
            }
          }
        } else {
          if (segIdx !== currentSegRef.current && segIdx >= 0) {
            const seg = scriptRef.segments[segIdx];
            if (seg.audioFile) {
              cleanupAudio();
              const audio = new Audio(mediaApi.streamUrl(seg.audioFile));
              audio.play().catch(() => {});
              audioRef.current = audio;
            }
          }
        }
        currentSegRef.current = segIdx;

        setState((prev) => ({
          ...prev,
          currentTimeMs: timeMs,
          currentSegmentIndex: segIdx,
        }));

        // Completion check: only finalize if NOT paused and device is not playing
        // When paused, syncScriptStop makes the device report non-playing, but we
        // distinguish that from real completion via isPausedRef
        const isComplete = !isPausedRef.current && (!isDevicePlaying || timeMs >= scriptRef.totalDurationMs);

        if (isComplete) {
          clearPollTimer();
          cleanupAudio();
          setState((prev) => ({
            ...prev,
            isPlaying: false,
            isPaused: false,
            isComplete: true,
          }));
          return; // Don't schedule next tick
        }
      } catch {
        pollFailureCountRef.current++;
        if (pollFailureCountRef.current >= MAX_POLL_FAILURES) {
          clearPollTimer();
          cleanupAudio();
          setState((prev) => ({
            ...prev,
            isPlaying: false,
            isPaused: false,
            error: 'Device communication lost',
          }));
          return;
        }
      }

      // Schedule next tick
      if (isPollingActiveRef.current) {
        schedulePollTick(ultraRef, scriptRef);
      }
    }, POSITION_POLL_MS);
  }, [cleanupAudio, clearPollTimer]);

  const startDemo = useCallback(async () => {
    if (!ultra || !script || script.actions.length === 0) return;

    // Clean up any existing playback before starting fresh
    clearPollTimer();
    cleanupAudio();
    currentSegRef.current = -1;
    triggeredCuesRef.current = new Set();
    currentTimeMsRef.current = 0;
    pollFailureCountRef.current = 0;
    isPausedRef.current = false;

    try {
      setState((prev) => ({ ...prev, error: null, isComplete: false }));

      const funscript = {
        version: '1.0',
        inverted: false,
        range: 100,
        actions: script.actions,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ultra.syncScriptUploadFunscriptFile(funscript as any);
      await ultra.syncScriptStart(0);

      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentTimeMs: 0,
        currentSegmentIndex: -1,
      }));

      isPollingActiveRef.current = true;
      schedulePollTick(ultra, script);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(err, 'Failed to start demo'),
        isPlaying: false,
      }));
    }
  }, [ultra, script, cleanupAudio, clearPollTimer, schedulePollTick]);

  const stopDemo = useCallback(async () => {
    // Always clean up local state, even if ultra is null (e.g., device disconnected)
    if (ultra) {
      try {
        await ultra.syncScriptStop();
      } catch {
        // Best-effort stop
      }
    }

    clearPollTimer();
    cleanupAudio();
    currentSegRef.current = -1;
    triggeredCuesRef.current = new Set();
    currentTimeMsRef.current = 0;
    pollFailureCountRef.current = 0;
    isPausedRef.current = false;

    setState({
      isPlaying: false,
      isPaused: false,
      currentTimeMs: 0,
      currentSegmentIndex: -1,
      error: null,
      isComplete: false,
    });
  }, [ultra, clearPollTimer, cleanupAudio]);

  const togglePause = useCallback(async () => {
    if (!ultra || !state.isPlaying) return;

    try {
      if (state.isPaused) {
        isPausedRef.current = false;
        await ultra.syncScriptStart(currentTimeMsRef.current);
        setState((prev) => ({ ...prev, isPaused: false }));
      } else {
        isPausedRef.current = true;
        await ultra.syncScriptStop();
        cleanupAudio();
        setState((prev) => ({ ...prev, isPaused: true }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(err, 'Pause/resume failed'),
      }));
    }
  }, [ultra, state.isPlaying, state.isPaused, cleanupAudio]);

  useEffect(() => {
    return () => {
      clearPollTimer();
      cleanupAudio();
    };
  }, [clearPollTimer, cleanupAudio]);

  return {
    ...state,
    startDemo,
    stopDemo,
    togglePause,
  };
}
