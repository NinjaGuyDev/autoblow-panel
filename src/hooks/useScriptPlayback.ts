/**
 * Script playback state machine for the Script Library.
 * Manages single-script looping and randomized continuous playback
 * with smooth transitions between scripts.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { LibraryItem } from '../../server/types/shared';
import { useScriptLoop } from '@/hooks/useScriptLoop';
import {
  parseScriptActions,
  prepareLoopedScript,
  prepareTransitionedScript,
  shuffleArray,
  pickRandomIndex,
} from '@/lib/scriptPlaybackUtils';
import type { FunscriptAction } from '@/types/funscript';

export type RandomizeMode = 'off' | 'play-all' | 'full-random';

interface UseScriptPlaybackParams {
  ultra: Ultra | null;
  scripts: LibraryItem[];
}

interface UseScriptPlaybackReturn {
  isPlaying: boolean;
  isPaused: boolean;
  currentScriptId: number | null;
  nextScriptId: number | null;
  playbackError: string | null;
  randomizeMode: RandomizeMode;
  scriptDurationMs: number;
  currentTimeMs: number;
  currentActions: FunscriptAction[];
  setRandomizeMode: (mode: RandomizeMode) => void;
  playSingle: (item: LibraryItem) => Promise<void>;
  stop: () => Promise<void>;
  startRandomize: () => Promise<void>;
  togglePause: () => Promise<void>;
  seek: (timeMs: number) => Promise<void>;
}

export function useScriptPlayback({ ultra, scripts }: UseScriptPlaybackParams): UseScriptPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentScriptId, setCurrentScriptId] = useState<number | null>(null);
  const [nextScriptId, setNextScriptId] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [randomizeMode, setRandomizeMode] = useState<RandomizeMode>('off');
  const [scriptDurationMs, setScriptDurationMs] = useState(0);

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [currentActions, setCurrentActions] = useState<FunscriptAction[]>([]);

  const shuffleQueueRef = useRef<number[]>([]);
  const currentActionsRef = useRef<FunscriptAction[]>([]);
  const transitioningRef = useRef(false);
  const pausedAtRef = useRef<number>(0);
  const playbackStartRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);

  // RAF-based elapsed time tracker
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const tick = () => {
      const elapsed = playbackOffsetRef.current + (performance.now() - playbackStartRef.current);
      const capped = scriptDurationMs > 0 ? Math.min(elapsed, scriptDurationMs) : elapsed;
      setCurrentTimeMs(capped);
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [isPlaying, isPaused, scriptDurationMs]);

  /**
   * Seek to a specific time in the current script.
   */
  const seek = useCallback(async (timeMs: number) => {
    if (!ultra || !isPlaying) return;

    try {
      await ultra.syncScriptStart(timeMs);
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Seek failed');
      return;
    }

    playbackOffsetRef.current = timeMs;
    playbackStartRef.current = performance.now();
    setCurrentTimeMs(timeMs);

    if (isPaused) {
      pausedAtRef.current = Math.max(0, Math.min(timeMs, scriptDurationMs));
    }
  }, [ultra, isPlaying, isPaused, scriptDurationMs]);

  /**
   * Pick the next script ID based on randomize mode.
   * Returns null if no scripts available.
   */
  const pickNextId = useCallback((mode: RandomizeMode, currentId: number | null): number | null => {
    if (scripts.length === 0) return null;

    if (mode === 'full-random') {
      return scripts[pickRandomIndex(scripts.length)].id;
    }

    if (mode === 'play-all') {
      // Pop from shuffle queue
      if (shuffleQueueRef.current.length === 0) {
        const ids = scripts.map(s => s.id);
        shuffleQueueRef.current = shuffleArray(ids);

        // Skip immediate repeat at queue boundary
        if (shuffleQueueRef.current[0] === currentId && shuffleQueueRef.current.length > 1) {
          const first = shuffleQueueRef.current.shift()!;
          shuffleQueueRef.current.push(first);
        }
      }
      return shuffleQueueRef.current.shift() ?? null;
    }

    return null;
  }, [scripts]);

  /**
   * Upload a funscript to the device and start playback.
   */
  const uploadAndPlay = useCallback(async (
    actions: FunscriptAction[],
    looped: boolean,
  ): Promise<{ durationMs: number }> => {
    if (!ultra) throw new Error('Device not connected');

    const { funscript, durationMs } = looped
      ? prepareLoopedScript(actions)
      : { funscript: { actions }, durationMs: actions[actions.length - 1]?.at ?? 0 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ultra.syncScriptUploadFunscriptFile(funscript as any);
    await ultra.syncScriptStart(0);
    return { durationMs };
  }, [ultra]);

  /**
   * Play a single script on loop.
   */
  const playSingle = useCallback(async (item: LibraryItem) => {
    setPlaybackError(null);

    try {
      const actions = parseScriptActions(item);
      if (actions.length === 0) {
        setPlaybackError('Script has no actions');
        return;
      }

      // Stop current playback if any
      if (isPlaying && ultra) {
        try { await ultra.syncScriptStop(); } catch { /* ignore */ }
      }

      currentActionsRef.current = actions;
      setCurrentActions(actions);
      const { durationMs } = await uploadAndPlay(actions, true);

      // Reset time tracking
      playbackOffsetRef.current = 0;
      playbackStartRef.current = performance.now();
      setCurrentTimeMs(0);

      setCurrentScriptId(item.id);
      setScriptDurationMs(durationMs);
      setIsPlaying(true);
      setIsPaused(false);

      // If randomize mode is active, pre-pick the next script
      if (randomizeMode !== 'off') {
        const next = pickNextId(randomizeMode, item.id);
        setNextScriptId(next);
      } else {
        setNextScriptId(null);
      }
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Playback failed');
      setIsPlaying(false);
    }
  }, [ultra, isPlaying, uploadAndPlay, randomizeMode, pickNextId]);

  /**
   * Stop all playback.
   */
  const stop = useCallback(async () => {
    if (ultra) {
      try { await ultra.syncScriptStop(); } catch { /* ignore */ }
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentScriptId(null);
    setNextScriptId(null);
    setScriptDurationMs(0);
    setCurrentTimeMs(0);
    setCurrentActions([]);
    currentActionsRef.current = [];
    transitioningRef.current = false;
    pausedAtRef.current = 0;
    playbackOffsetRef.current = 0;
  }, [ultra]);

  /**
   * Toggle pause/resume for script playback.
   * Queries the device for current position before pausing so we can resume from the same spot.
   */
  const togglePause = useCallback(async () => {
    if (!ultra || !isPlaying) return;

    try {
      if (isPaused) {
        // Resume from paused position and reset the RAF baseline
        await ultra.syncScriptStart(pausedAtRef.current);
        playbackOffsetRef.current = pausedAtRef.current;
        playbackStartRef.current = performance.now();
        setIsPaused(false);
      } else {
        // Query device for authoritative position before stopping
        const state = await ultra.getState();
        const deviceTimeMs = Number(state.syncScriptCurrentTime ?? pausedAtRef.current);
        pausedAtRef.current = deviceTimeMs;
        playbackOffsetRef.current = deviceTimeMs;
        await ultra.syncScriptStop();
        setIsPaused(true);
      }
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Pause/resume failed');
    }
  }, [ultra, isPlaying, isPaused]);

  /**
   * Start randomized playback — pick the first script and play it.
   */
  const startRandomize = useCallback(async () => {
    if (scripts.length === 0) return;
    setPlaybackError(null);

    // Reset shuffle queue for play-all
    if (randomizeMode === 'play-all') {
      shuffleQueueRef.current = [];
    }

    const firstId = pickNextId(randomizeMode, null);
    if (firstId === null) return;

    const item = scripts.find(s => s.id === firstId);
    if (!item) return;

    await playSingle(item);
  }, [scripts, randomizeMode, pickNextId, playSingle]);

  /**
   * Loop end callback — handles what happens when current script finishes.
   */
  const handleLoopEnd = useCallback(async () => {
    // Guard against re-entrant calls
    if (transitioningRef.current) return;

    // Reset time tracking on any loop restart
    const resetTimeTracking = () => {
      playbackOffsetRef.current = 0;
      playbackStartRef.current = performance.now();
      setCurrentTimeMs(0);
    };

    if (randomizeMode === 'off') {
      // Simple restart
      if (ultra) {
        try { await ultra.syncScriptStart(0); } catch { /* ignore */ }
      }
      resetTimeTracking();
      return;
    }

    // Transition to next script
    if (nextScriptId === null) {
      // No next script — restart current
      if (ultra) {
        try { await ultra.syncScriptStart(0); } catch { /* ignore */ }
      }
      resetTimeTracking();
      return;
    }

    const nextItem = scripts.find(s => s.id === nextScriptId);
    if (!nextItem) {
      if (ultra) {
        try { await ultra.syncScriptStart(0); } catch { /* ignore */ }
      }
      resetTimeTracking();
      return;
    }

    transitioningRef.current = true;

    try {
      const nextActions = parseScriptActions(nextItem);
      if (nextActions.length === 0) {
        if (ultra) await ultra.syncScriptStart(0);
        transitioningRef.current = false;
        return;
      }

      const { funscript, durationMs } = prepareTransitionedScript(
        currentActionsRef.current,
        nextActions,
      );

      if (!ultra) {
        transitioningRef.current = false;
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ultra.syncScriptUploadFunscriptFile(funscript as any);
      await ultra.syncScriptStart(0);

      // Advance state
      currentActionsRef.current = nextActions;
      setCurrentActions(nextActions);
      setCurrentScriptId(nextScriptId);
      setScriptDurationMs(durationMs);
      resetTimeTracking();

      // Pick the next-next script
      const newNext = pickNextId(randomizeMode, nextScriptId);
      setNextScriptId(newNext);
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      transitioningRef.current = false;
    }
  }, [ultra, randomizeMode, nextScriptId, scripts, pickNextId]);

  // Wire up the loop detection — skip loop checks while paused
  useScriptLoop(ultra, isPlaying && !isPaused, scriptDurationMs, handleLoopEnd);

  return {
    isPlaying,
    isPaused,
    currentScriptId,
    nextScriptId,
    playbackError,
    randomizeMode,
    scriptDurationMs,
    currentTimeMs,
    currentActions,
    setRandomizeMode,
    playSingle,
    stop,
    startRandomize,
    togglePause,
    seek,
  };
}
