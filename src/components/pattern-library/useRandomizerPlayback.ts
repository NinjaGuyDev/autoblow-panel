import { useState, useCallback, useRef, useEffect } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { RandomizedScript } from '@/types/randomizer';
import { mediaApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';

const POSITION_POLL_MS = 200;

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

      currentSegRef.current = -1;

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
          const timeMs = deviceState.syncScriptCurrentTime ?? 0;
          const isDevicePlaying = deviceState.operationalMode === 'SYNC_SCRIPT_PLAYING';

          let segIdx = -1;
          if (script.segments.length > 0) {
            for (let i = script.segments.length - 1; i >= 0; i--) {
              if (timeMs >= script.segments[i].startMs) {
                segIdx = i;
                break;
              }
            }
          }

          if (segIdx !== currentSegRef.current && segIdx >= 0) {
            currentSegRef.current = segIdx;
            const seg = script.segments[segIdx];
            if (seg.audioFile) {
              cleanupAudio();
              const audio = new Audio(mediaApi.streamUrl(seg.audioFile));
              audio.play().catch(() => {});
              audioRef.current = audio;
            }
          }

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
          // Device communication error — continue polling
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
        await ultra.syncScriptStart(state.currentTimeMs);
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
  }, [ultra, state.isPlaying, state.isPaused, state.currentTimeMs, cleanupAudio]);

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
