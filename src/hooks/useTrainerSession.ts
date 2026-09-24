/**
 * Trainer playback state machine.
 *
 * Loops one pattern on the device until the user ranks it. A rank is held as
 * pending — a later key press replaces it — and is saved when the current pass
 * finishes, at which point a different pattern starts. Stopping (or leaving the
 * page) saves a pending rank too, so no input is lost.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { TrainerPattern } from '@server/types/shared';
import type { Funscript, FunscriptAction } from '@/types/funscript';
import { useScriptLoop } from '@/hooks/useScriptLoop';
import { pickNextPattern } from '@/lib/trainer/patternSelection';
import { buildTrainerLoop, loopEndPosition, type TrainerLoop } from '@/lib/trainer/trainerLoop';
import { getErrorMessage } from '@/lib/getErrorMessage';

export type TrainerStatus = 'idle' | 'starting' | 'playing';

interface UseTrainerSessionParams {
  ultra: Ultra | null;
  patterns: TrainerPattern[];
  /** Persists one rank and returns the pattern with refreshed stats. */
  recordRank: (patternId: number, rank: number) => Promise<TrainerPattern>;
}

interface UseTrainerSessionReturn {
  status: TrainerStatus;
  currentPattern: TrainerPattern | null;
  /** Rank entered for the current pattern, saved when its pass finishes. */
  pendingRank: number | null;
  /** Passes of the current pattern so far, counting the one playing. */
  passCount: number;
  /** The funscript on the device: the pattern plus its lead-in and loop seam. */
  loopActions: FunscriptAction[];
  loopDurationMs: number;
  currentTimeMs: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  rank: (rank: number) => void;
  seek: (timeMs: number) => Promise<void>;
}

const EMPTY_LOOP: TrainerLoop = { actions: [], durationMs: 0, leadInMs: 0 };

export function useTrainerSession({ ultra, patterns, recordRank }: UseTrainerSessionParams): UseTrainerSessionReturn {
  const [status, setStatus] = useState<TrainerStatus>('idle');
  const [currentPattern, setCurrentPattern] = useState<TrainerPattern | null>(null);
  const [pendingRank, setPendingRankState] = useState<number | null>(null);
  const [passCount, setPassCount] = useState(0);
  const [loop, setLoop] = useState<TrainerLoop>(EMPTY_LOOP);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs so the async loop-end path and unmount cleanup never read stale state
  const statusRef = useRef<TrainerStatus>('idle');
  const patternsRef = useRef(patterns);
  const currentPatternRef = useRef<TrainerPattern | null>(null);
  const pendingRankRef = useRef<number | null>(null);
  const loopRef = useRef<TrainerLoop>(EMPTY_LOOP);
  const loopStartedAtRef = useRef(0);
  const transitioningRef = useRef(false);
  /** Bumped on start/stop so an in-flight transition can tell it has been cancelled. */
  const sessionRef = useRef(0);
  const ultraRef = useRef(ultra);
  const recordRankRef = useRef(recordRank);

  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { ultraRef.current = ultra; }, [ultra]);
  useEffect(() => { recordRankRef.current = recordRank; }, [recordRank]);

  const updateStatus = useCallback((next: TrainerStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const setPendingRank = useCallback((rank: number | null) => {
    pendingRankRef.current = rank;
    setPendingRankState(rank);
  }, []);

  const restartClock = useCallback((atMs: number) => {
    loopStartedAtRef.current = performance.now() - atMs;
    setCurrentTimeMs(atMs);
  }, []);

  const adoptLoop = useCallback((next: TrainerLoop) => {
    loopRef.current = next;
    setLoop(next);
    restartClock(0);
  }, [restartClock]);

  const showPattern = useCallback((pattern: TrainerPattern) => {
    currentPatternRef.current = pattern;
    setCurrentPattern(pattern);
    setPassCount(1);
  }, []);

  /** @throws Error when the device is missing or rejects the upload or start. */
  const uploadAndStart = useCallback(async (next: TrainerLoop) => {
    if (!ultra) throw new Error('Device not connected');
    const funscript: Funscript = { actions: next.actions };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ultra.syncScriptUploadFunscriptFile(funscript as any);
    await ultra.syncScriptStart(0);
  }, [ultra]);

  const stopDevice = useCallback(async () => {
    try { await ultraRef.current?.syncScriptStop(); } catch { /* already stopped */ }
  }, []);

  /** Save the pending rank. Returns the refreshed pattern, or null when nothing was saved. */
  const commitPendingRank = useCallback(async (): Promise<TrainerPattern | null> => {
    const rank = pendingRankRef.current;
    const pattern = currentPatternRef.current;
    if (rank === null || !pattern) return null;

    setPendingRank(null);
    try {
      return await recordRankRef.current(pattern.id, rank);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save rank'));
      return null;
    }
  }, [setPendingRank]);

  /** Ranked: save the rank and move on to a different pattern. */
  const switchPattern = useCallback(async (session: number) => {
    const finishedId = currentPatternRef.current?.id ?? null;
    const refreshed = await commitPendingRank();
    // The refreshed stats are not in `patterns` until the next render
    const candidates = refreshed
      ? patternsRef.current.map(p => (p.id === refreshed.id ? refreshed : p))
      : patternsRef.current;

    const next = pickNextPattern(candidates, finishedId);
    if (!next) return;

    const nextLoop = buildTrainerLoop(next.actions, loopEndPosition(loopRef.current));
    await uploadAndStart(nextLoop);
    if (sessionRef.current !== session) return stopDevice();

    adoptLoop(nextLoop);
    showPattern(next);
  }, [commitPendingRank, uploadAndStart, stopDevice, adoptLoop, showPattern]);

  /** Not ranked yet: play the same pattern again. */
  const repeatPattern = useCallback(async (session: number) => {
    const pattern = currentPatternRef.current;
    if (!pattern || !ultra) return;

    if (loopRef.current.leadInMs > 0) {
      // The lead-in from the previous pattern only belongs on the first pass
      const plainLoop = buildTrainerLoop(pattern.actions, null);
      await uploadAndStart(plainLoop);
      if (sessionRef.current !== session) return stopDevice();
      adoptLoop(plainLoop);
    } else {
      await ultra.syncScriptStart(0);
      if (sessionRef.current !== session) return stopDevice();
      restartClock(0);
    }
    setPassCount(count => count + 1);
  }, [ultra, uploadAndStart, stopDevice, adoptLoop, restartClock]);

  const handleLoopEnd = useCallback(async () => {
    if (transitioningRef.current || statusRef.current !== 'playing') return;

    transitioningRef.current = true;
    const session = sessionRef.current;
    try {
      if (pendingRankRef.current !== null) {
        await switchPattern(session);
      } else {
        await repeatPattern(session);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Playback failed'));
    } finally {
      transitioningRef.current = false;
    }
  }, [switchPattern, repeatPattern]);

  useScriptLoop(ultra, status === 'playing', loop.durationMs, handleLoopEnd);

  const start = useCallback(async () => {
    if (statusRef.current !== 'idle') return;

    const first = pickNextPattern(patternsRef.current, null);
    if (!first) {
      setError('No trainer patterns to play');
      return;
    }

    const session = ++sessionRef.current;
    setError(null);
    updateStatus('starting');
    try {
      const firstLoop = buildTrainerLoop(first.actions, null);
      await uploadAndStart(firstLoop);
      if (sessionRef.current !== session) return stopDevice();
      adoptLoop(firstLoop);
      showPattern(first);
      updateStatus('playing');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start training'));
      updateStatus('idle');
    }
  }, [uploadAndStart, stopDevice, adoptLoop, showPattern, updateStatus]);

  const stop = useCallback(async () => {
    if (statusRef.current === 'idle') return;

    sessionRef.current++;
    await commitPendingRank();
    await stopDevice();

    currentPatternRef.current = null;
    setCurrentPattern(null);
    loopRef.current = EMPTY_LOOP;
    setLoop(EMPTY_LOOP);
    setPassCount(0);
    setCurrentTimeMs(0);
    updateStatus('idle');
  }, [commitPendingRank, stopDevice, updateStatus]);

  const rank = useCallback((value: number) => {
    if (statusRef.current === 'playing') setPendingRank(value);
  }, [setPendingRank]);

  const seek = useCallback(async (timeMs: number) => {
    if (!ultra || statusRef.current !== 'playing') return;
    const target = Math.round(Math.max(0, Math.min(timeMs, loopRef.current.durationMs)));
    try {
      await ultra.syncScriptStart(target);
      restartClock(target);
    } catch (err) {
      setError(getErrorMessage(err, 'Seek failed'));
    }
  }, [ultra, restartClock]);

  // Playhead clock
  useEffect(() => {
    if (status !== 'playing') return;

    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - loopStartedAtRef.current;
      setCurrentTimeMs(Math.min(Math.max(0, elapsed), loopRef.current.durationMs));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  // Leaving the page stops the device and keeps a rank entered for the last pattern
  useEffect(() => () => {
    if (statusRef.current === 'idle') return;
    sessionRef.current++;

    const rank = pendingRankRef.current;
    const pattern = currentPatternRef.current;
    if (rank !== null && pattern) {
      recordRankRef.current(pattern.id, rank).catch(() => { /* page is gone; nothing to report to */ });
    }
    void stopDevice();
  }, [stopDevice]);

  return {
    status,
    currentPattern,
    pendingRank,
    passCount,
    loopActions: loop.actions,
    loopDurationMs: loop.durationMs,
    currentTimeMs,
    error,
    start,
    stop,
    rank,
    seek,
  };
}
