/**
 * Script playback state machine for the Script Library.
 * Manages single-script looping and randomized continuous playback
 * with smooth transitions between scripts.
 *
 * Playback can run under a time warp (a numpad speed factor or a saved mod).
 * The device and the RAF clock run in *warped* time; everything this hook
 * exposes to the UI — `currentTimeMs`, `scriptDurationMs`, `seek` — is in
 * *original* script time.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { LibraryItem, ScriptMod } from '@server/types/shared';
import { useScriptLoop } from '@/hooks/useScriptLoop';
import {
  parseScriptActions,
  prepareLoopedScript,
  prepareTransitionedScript,
  shuffleArray,
  pickRandomIndex,
} from '@/lib/scriptPlaybackUtils';
import {
  applyWarp,
  buildUniformWarp,
  buildWarp,
  MAX_SPEED_FACTOR,
  MIN_SPEED_FACTOR,
  type TimeWarp,
} from '@/lib/timeWarp';
import { compileMod } from '@/lib/modCompiler';
import { compileEdgeMode, edgeModeEndOriginalMs } from '@/lib/edgeMode';
import {
  NO_WARP,
  activeMod as activeModOf,
  resumeAfterEdge,
  startEdge,
  suspendedMod as suspendedModOf,
  type WarpSource,
} from '@/lib/warpSource';
import { createRandomSeed, createSeededRng } from '@/lib/seededRng';
import type { FunscriptAction, Funscript } from '@/types/funscript';

export type RandomizeMode = 'off' | 'play-all' | 'full-random';

function clampSpeedFactor(factor: number): number {
  return Math.min(MAX_SPEED_FACTOR, Math.max(MIN_SPEED_FACTOR, factor));
}

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
  speedFactor: number;
  activeMod: ScriptMod | null;
  edgeModeActive: boolean;
  suspendedMod: ScriptMod | null;
  setRandomizeMode: (mode: RandomizeMode) => void;
  playSingle: (item: LibraryItem) => Promise<void>;
  stop: () => Promise<void>;
  startRandomize: () => Promise<void>;
  togglePause: () => Promise<void>;
  seek: (timeMs: number) => Promise<void>;
  previewSpeedFactor: (factor: number) => void;
  setSpeedFactor: (factor: number) => Promise<void>;
  applyMod: (mod: ScriptMod) => Promise<void>;
  startEdgeMode: () => Promise<void>;
  clearWarp: () => Promise<void>;
}

export function useScriptPlayback({ ultra, scripts }: UseScriptPlaybackParams): UseScriptPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentScriptId, setCurrentScriptId] = useState<number | null>(null);
  const [nextScriptId, setNextScriptId] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [randomizeMode, setRandomizeMode] = useState<RandomizeMode>('off');
  const [scriptDurationMs, setScriptDurationMs] = useState(0);
  const [warpedDurationMs, setWarpedDurationMs] = useState(0);
  const [speedFactor, setSpeedFactorState] = useState(1);
  const [activeMod, setActiveMod] = useState<ScriptMod | null>(null);
  const [edgeModeActive, setEdgeModeActive] = useState(false);
  const [suspendedMod, setSuspendedMod] = useState<ScriptMod | null>(null);

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [currentActions, setCurrentActions] = useState<FunscriptAction[]>([]);

  const shuffleQueueRef = useRef<number[]>([]);
  const currentActionsRef = useRef<FunscriptAction[]>([]);
  const transitioningRef = useRef(false);
  const pausedAtRef = useRef<number>(0);
  const playbackStartRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);

  // Warp bookkeeping — refs so the async playback paths never read stale state
  const warpRef = useRef<TimeWarp | null>(null);
  const warpedDurationRef = useRef(0);
  const warpSourceRef = useRef<WarpSource>(NO_WARP);
  /** Original time at which an edge program hands playback back at 1x. */
  const edgeEndOriginalRef = useRef(0);
  const isPausedRef = useRef(false);
  const isPlayingRef = useRef(false);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  /** Device playhead in warped time. */
  const currentWarpedTimeMs = useCallback((): number => {
    if (isPausedRef.current) return pausedAtRef.current;

    const elapsed = playbackOffsetRef.current + (performance.now() - playbackStartRef.current);
    const bounded = Math.max(0, elapsed);
    return warpedDurationRef.current > 0 ? Math.min(bounded, warpedDurationRef.current) : bounded;
  }, []);

  /** Device playhead expressed in original script time. */
  const currentOriginalTimeMs = useCallback((): number => {
    const warped = currentWarpedTimeMs();
    return warpRef.current ? warpRef.current.warpedToOriginal(warped) : warped;
  }, [currentWarpedTimeMs]);

  /** Forget any active warp — used on stop and whenever the script changes. */
  const resetWarpState = useCallback(() => {
    warpRef.current = null;
    warpSourceRef.current = NO_WARP;
    edgeEndOriginalRef.current = 0;
    setSpeedFactorState(1);
    setActiveMod(null);
    setEdgeModeActive(false);
    setSuspendedMod(null);
  }, []);

  // RAF-based elapsed time tracker — the device clock is warped, the UI clock is not
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const tick = () => {
      const elapsed = playbackOffsetRef.current + (performance.now() - playbackStartRef.current);
      const capped = warpedDurationMs > 0 ? Math.min(elapsed, warpedDurationMs) : elapsed;
      const warp = warpRef.current;
      setCurrentTimeMs(warp ? warp.warpedToOriginal(capped) : capped);
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [isPlaying, isPaused, warpedDurationMs]);

  /**
   * Seek to a specific time in the current script.
   * `timeMs` is original script time; the device is driven in warped time.
   */
  const seek = useCallback(async (timeMs: number) => {
    if (!ultra || !isPlaying) return;

    const clampedOriginal = Math.max(0, Math.min(timeMs, scriptDurationMs));
    const warp = warpRef.current;
    const warpedTarget = warp ? warp.originalToWarped(clampedOriginal) : clampedOriginal;
    const deviceTime = Math.max(0, Math.round(warpedTarget));

    try {
      // Stop the device first when paused so syncScriptStart doesn't resume playback
      if (isPaused) {
        await ultra.syncScriptStop();
      }
      await ultra.syncScriptStart(deviceTime);
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Seek failed');
      return;
    }

    playbackOffsetRef.current = deviceTime;
    playbackStartRef.current = performance.now();
    setCurrentTimeMs(clampedOriginal);
    pausedAtRef.current = deviceTime;
  }, [ultra, isPlaying, isPaused, scriptDurationMs]);

  /**
   * Build the warp for the current script under a speed factor or a mod.
   * Returns null when playback should run unmodified.
   */
  const buildActiveWarp = useCallback((
    actions: FunscriptAction[],
    source: WarpSource,
  ): TimeWarp | null => {
    if (actions.length === 0) return null;

    const durationMs = actions[actions.length - 1]!.at;
    if (durationMs <= 0) return null;

    try {
      if (source.kind === 'mod') {
        const segments = compileMod(source.mod.definition, durationMs, createSeededRng(createRandomSeed()));
        return segments.length > 0 ? buildWarp(segments, durationMs) : null;
      }
      if (source.kind === 'edge') {
        const segments = compileEdgeMode(source.startOriginalMs, durationMs);
        edgeEndOriginalRef.current = edgeModeEndOriginalMs(segments, source.startOriginalMs);
        return segments.length > 0 ? buildWarp(segments, durationMs) : null;
      }
      return source.factor === 1 ? null : buildUniformWarp(durationMs, source.factor);
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Could not compile mod');
      return null;
    }
  }, []);

  /**
   * Hot-swap the device script: re-derive the warped funscript from the
   * pristine actions and restart at the mapped position. Deriving from the
   * pristine source is what keeps successive changes from compounding.
   */
  const reloadWarpedScript = useCallback(async (
    source: WarpSource,
    resumeAtOriginalMs: number,
  ): Promise<void> => {
    const original = currentActionsRef.current;
    if (!ultra || original.length === 0) return;

    const warp = buildActiveWarp(original, source);
    const warpedActions = warp ? applyWarp(original, warp) : original;
    const { funscript, durationMs } = prepareLoopedScript(warpedActions);

    const warpedTarget = warp ? warp.originalToWarped(resumeAtOriginalMs) : resumeAtOriginalMs;
    const startAtMs = Math.max(0, Math.min(Math.round(warpedTarget), durationMs));

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ultra.syncScriptUploadFunscriptFile(funscript as any);
    } catch {
      // Some firmware refuses an upload mid-playback — stop, then retry once
      try { await ultra.syncScriptStop(); } catch { /* already stopped */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ultra.syncScriptUploadFunscriptFile(funscript as any);
    }

    // Mirrors seek(): stopping first keeps a paused session paused
    if (isPausedRef.current) {
      await ultra.syncScriptStop();
    }
    await ultra.syncScriptStart(startAtMs);

    warpRef.current = warp;
    warpedDurationRef.current = durationMs;
    setWarpedDurationMs(durationMs);
    playbackOffsetRef.current = startAtMs;
    playbackStartRef.current = performance.now();
    pausedAtRef.current = startAtMs;
    setCurrentTimeMs(resumeAtOriginalMs);
  }, [ultra, buildActiveWarp]);

  /**
   * Reflect a pending factor in the UI without touching the device.
   * The keyboard control debounces uploads, and the badge should not lag behind
   * the keypress that caused it.
   */
  const previewSpeedFactor = useCallback((factor: number) => {
    setSpeedFactorState(clampSpeedFactor(factor));
    setActiveMod(null);
    setEdgeModeActive(false);
    setSuspendedMod(null);
  }, []);

  /** Apply a speed factor and clear any active mod — the two are exclusive. */
  const setSpeedFactor = useCallback(async (factor: number) => {
    const clamped = clampSpeedFactor(factor);

    warpSourceRef.current = { kind: 'factor', factor: clamped };
    setSpeedFactorState(clamped);
    setActiveMod(null);
    setEdgeModeActive(false);
    setSuspendedMod(null);

    if (!isPlayingRef.current) return;

    setPlaybackError(null);
    try {
      await reloadWarpedScript(warpSourceRef.current, currentOriginalTimeMs());
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Speed change failed');
    }
  }, [reloadWarpedScript, currentOriginalTimeMs]);

  /** Apply a saved mod and clear any manual speed factor — the two are exclusive. */
  const applyMod = useCallback(async (mod: ScriptMod) => {
    warpSourceRef.current = { kind: 'mod', mod };
    setSpeedFactorState(1);
    setActiveMod(mod);
    setEdgeModeActive(false);
    setSuspendedMod(null);

    if (!isPlayingRef.current) return;

    setPlaybackError(null);
    try {
      await reloadWarpedScript(warpSourceRef.current, currentOriginalTimeMs());
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Could not apply mod');
    }
  }, [reloadWarpedScript, currentOriginalTimeMs]);

  /**
   * Run the edge program from the current playhead.
   * Unlike a factor or a mod it is one-shot: it is anchored where it started
   * and expires on its own, after which playback continues at original speed.
   */
  const startEdgeMode = useCallback(async () => {
    if (!isPlayingRef.current) return;

    const previous = warpSourceRef.current;
    const startOriginalMs = currentOriginalTimeMs();
    const source = startEdge(previous, startOriginalMs);

    warpSourceRef.current = source;
    setSpeedFactorState(1);
    setActiveMod(null);
    setSuspendedMod(suspendedModOf(source));
    setEdgeModeActive(true);

    setPlaybackError(null);
    try {
      await reloadWarpedScript(source, startOriginalMs);
    } catch (err) {
      // Put the displaced mod back rather than silently dropping it
      warpSourceRef.current = previous;
      setActiveMod(activeModOf(previous));
      setSuspendedMod(null);
      setEdgeModeActive(false);
      setPlaybackError(err instanceof Error ? err.message : 'Could not start edge mode');
    }
  }, [reloadWarpedScript, currentOriginalTimeMs]);

  /**
   * Retire the edge program and hand playback back to whatever it displaced.
   *
   * With no suspended mod this is pure bookkeeping — the compiled program
   * already returns the rest of the script to original speed. A suspended mod
   * has to be recompiled and re-uploaded from the current position.
   */
  const endEdgeMode = useCallback(async () => {
    const source = warpSourceRef.current;
    if (source.kind !== 'edge') return;

    const resumed = resumeAfterEdge(source);
    // Flipped before any await so the watcher below cannot fire twice
    warpSourceRef.current = resumed;
    setEdgeModeActive(false);
    setSuspendedMod(null);
    setActiveMod(activeModOf(resumed));

    if (resumed.kind !== 'mod' || !isPlayingRef.current || transitioningRef.current) return;

    transitioningRef.current = true;
    try {
      await reloadWarpedScript(resumed, currentOriginalTimeMs());
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Could not resume mod');
    } finally {
      transitioningRef.current = false;
    }
  }, [reloadWarpedScript, currentOriginalTimeMs]);

  // Watch the playhead for the end of an edge program
  useEffect(() => {
    if (!edgeModeActive) return;
    if (currentTimeMs < edgeEndOriginalRef.current) return;
    void endEdgeMode();
  }, [edgeModeActive, currentTimeMs, endEdgeMode]);

  /** Return to unmodified playback. */
  const clearWarp = useCallback(async () => {
    await setSpeedFactor(1);
  }, [setSpeedFactor]);

  /**
   * Pick the next script ID based on randomize mode.
   * Returns null if no scripts available.
   */
  const pickNextId = useCallback((mode: RandomizeMode, currentId: number | null): number | null => {
    if (scripts.length === 0) return null;

    if (mode === 'full-random') {
      return scripts[pickRandomIndex(scripts.length)]!.id;
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
      : { funscript: { actions } as Funscript, durationMs: actions[actions.length - 1]?.at ?? 0 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ultra.syncScriptUploadFunscriptFile(funscript as any);
    await ultra.syncScriptStart(0);
    return { durationMs };
  }, [ultra]);

  /**
   * Play a single script on loop.
   * A selected speed factor or mod is re-compiled against the new script, which
   * is what lets a mod be armed before playback starts.
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

      // The UI timeline and seek() work in original time; the device does not
      const { durationMs: originalDurationMs } = prepareLoopedScript(actions);

      const warp = buildActiveWarp(actions, warpSourceRef.current);
      const { durationMs: deviceDurationMs } = await uploadAndPlay(
        warp ? applyWarp(actions, warp) : actions,
        true,
      );

      // Reset time tracking
      playbackOffsetRef.current = 0;
      playbackStartRef.current = performance.now();
      pausedAtRef.current = 0;
      setCurrentTimeMs(0);

      warpRef.current = warp;
      setCurrentScriptId(item.id);
      setScriptDurationMs(originalDurationMs);
      warpedDurationRef.current = deviceDurationMs;
      setWarpedDurationMs(deviceDurationMs);
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
  }, [ultra, isPlaying, uploadAndPlay, randomizeMode, pickNextId, buildActiveWarp]);

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
    setWarpedDurationMs(0);
    setCurrentTimeMs(0);
    setCurrentActions([]);
    currentActionsRef.current = [];
    transitioningRef.current = false;
    pausedAtRef.current = 0;
    playbackOffsetRef.current = 0;
    warpedDurationRef.current = 0;
    resetWarpState();
  }, [ultra, resetWarpState]);

  /**
   * Toggle pause/resume for script playback.
   * Queries the device for current position before pausing so we can resume from the same spot.
   * Device positions are warped time, which is exactly what syncScriptStart wants back.
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
        const warp = warpRef.current;
        setCurrentTimeMs(warp ? warp.warpedToOriginal(deviceTimeMs) : deviceTimeMs);
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
      const source = warpSourceRef.current;

      // An edge program is one-shot and anchored to where it started, so a loop
      // would replay it verbatim. Hand the next pass back at original speed.
      if (source.kind === 'edge') {
        const resumed = resumeAfterEdge(source);
        transitioningRef.current = true;
        warpSourceRef.current = resumed;
        setEdgeModeActive(false);
        setSuspendedMod(null);
        setActiveMod(activeModOf(resumed));
        try {
          await reloadWarpedScript(resumed, 0);
        } catch (err) {
          setPlaybackError(err instanceof Error ? err.message : 'Could not end edge mode');
        } finally {
          transitioningRef.current = false;
        }
        return;
      }

      // Re-roll a continuous mod each loop so its randomness stays alive
      if (source.kind === 'mod') {
        transitioningRef.current = true;
        try {
          await reloadWarpedScript(source, 0);
        } catch (err) {
          setPlaybackError(err instanceof Error ? err.message : 'Mod re-roll failed');
        } finally {
          transitioningRef.current = false;
        }
        return;
      }

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

      // Advance state. A transition splices two scripts together, so an active
      // warp no longer maps onto the uploaded timeline — drop it.
      resetWarpState();
      currentActionsRef.current = nextActions;
      setCurrentActions(nextActions);
      setCurrentScriptId(nextScriptId);
      setScriptDurationMs(durationMs);
      warpedDurationRef.current = durationMs;
      setWarpedDurationMs(durationMs);
      resetTimeTracking();

      // Pick the next-next script
      const newNext = pickNextId(randomizeMode, nextScriptId);
      setNextScriptId(newNext);
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      transitioningRef.current = false;
    }
  }, [ultra, randomizeMode, nextScriptId, scripts, pickNextId, reloadWarpedScript, resetWarpState]);

  // Wire up the loop detection against the device's own timeline — skip while paused
  useScriptLoop(ultra, isPlaying && !isPaused, warpedDurationMs, handleLoopEnd);

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
    speedFactor,
    activeMod,
    edgeModeActive,
    suspendedMod,
    setRandomizeMode,
    playSingle,
    stop,
    startRandomize,
    togglePause,
    seek,
    previewSpeedFactor,
    setSpeedFactor,
    applyMod,
    startEdgeMode,
    clearWarp,
  };
}
