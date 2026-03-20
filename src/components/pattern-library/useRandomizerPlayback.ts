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

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSegRef = useRef(-1);
  /** Tracks which audioTimeline cues have already been triggered this playback */
  const triggeredCuesRef = useRef<Set<number>>(new Set());
  /** Mutable ref for current position — used by togglePause to avoid stale closure */
  const currentTimeMsRef = useRef(0);
  /** Consecutive poll failure counter */
  const pollFailureCountRef = useRef(0);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  const clearPollInterval = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startDemo = useCallback(async () => {
    if (!ultra || !script || script.actions.length === 0) return;

    // Clean up any existing playback before starting fresh
    clearPollInterval();
    cleanupAudio();
    currentSegRef.current = -1;
    triggeredCuesRef.current = new Set();
    currentTimeMsRef.current = 0;
    pollFailureCountRef.current = 0;

    try {
      setState((prev) => ({ ...prev, error: null, isComplete: false }));

      const funscript = {
        version: '1.0',
        inverted: false,
        range: 100,
        actions: script.actions,
      };

      await ultra.syncScriptUploadFunscriptFile(funscript as any);
      await ultra.syncScriptStart(0);

      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentTimeMs: 0,
        currentSegmentIndex: -1,
      }));

      pollIntervalRef.current = setInterval(async () => {
        try {
          const deviceState = await ultra.getState();
          pollFailureCountRef.current = 0; // Reset on success

          const timeMs = deviceState.syncScriptCurrentTime ?? 0;
          const isDevicePlaying = deviceState.operationalMode === 'SYNC_SCRIPT_PLAYING';

          currentTimeMsRef.current = timeMs;

          let segIdx = -1;
          if (script.segments.length > 0) {
            for (let i = script.segments.length - 1; i >= 0; i--) {
              if (timeMs >= script.segments[i].startMs) {
                segIdx = i;
                break;
              }
            }
          }

          // Audio triggering: audioTimeline takes priority over segment-based audio
          if (script.audioTimeline && script.audioTimeline.length > 0) {
            // Timeline mode: trigger cues at specific timestamps
            for (let ci = 0; ci < script.audioTimeline.length; ci++) {
              const cue = script.audioTimeline[ci];
              if (timeMs >= cue.startMs && !triggeredCuesRef.current.has(ci)) {
                triggeredCuesRef.current.add(ci);
                cleanupAudio();
                const audio = new Audio(mediaApi.streamUrl(cue.audioFile));
                audio.play().catch(() => {});
                audioRef.current = audio;
                break; // Only trigger one cue per poll cycle
              }
            }
          } else {
            // Segment mode: trigger audio on segment boundary change
            if (segIdx !== currentSegRef.current && segIdx >= 0) {
              const seg = script.segments[segIdx];
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

          if (!isDevicePlaying || timeMs >= script.totalDurationMs) {
            clearPollInterval();
            cleanupAudio();
            setState((prev) => ({
              ...prev,
              isPlaying: false,
              isPaused: false,
              isComplete: true,
            }));
          }
        } catch {
          pollFailureCountRef.current++;
          if (pollFailureCountRef.current >= MAX_POLL_FAILURES) {
            clearPollInterval();
            cleanupAudio();
            setState((prev) => ({
              ...prev,
              isPlaying: false,
              isPaused: false,
              error: 'Device communication lost',
            }));
          }
        }
      }, POSITION_POLL_MS);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: getErrorMessage(err, 'Failed to start demo'),
        isPlaying: false,
      }));
    }
  }, [ultra, script, cleanupAudio, clearPollInterval]);

  const stopDemo = useCallback(async () => {
    if (!ultra) return;

    try {
      await ultra.syncScriptStop();
    } catch {
      // Best-effort stop
    }

    clearPollInterval();
    cleanupAudio();
    currentSegRef.current = -1;
    triggeredCuesRef.current = new Set();
    currentTimeMsRef.current = 0;
    pollFailureCountRef.current = 0;

    setState({
      isPlaying: false,
      isPaused: false,
      currentTimeMs: 0,
      currentSegmentIndex: -1,
      error: null,
      isComplete: false,
    });
  }, [ultra, clearPollInterval, cleanupAudio]);

  const togglePause = useCallback(async () => {
    if (!ultra || !state.isPlaying) return;

    try {
      if (state.isPaused) {
        // Resume from the latest polled position (ref avoids stale closure)
        await ultra.syncScriptStart(currentTimeMsRef.current);
        setState((prev) => ({ ...prev, isPaused: false }));
      } else {
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
      clearPollInterval();
      cleanupAudio();
    };
  }, [clearPollInterval, cleanupAudio]);

  return {
    ...state,
    startDemo,
    stopDemo,
    togglePause,
  };
}
