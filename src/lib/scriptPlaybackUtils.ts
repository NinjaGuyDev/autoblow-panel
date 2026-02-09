/**
 * Pure utility functions for script-only playback.
 * Handles funscript parsing, loop preparation, transitions, and randomization.
 */

import type { FunscriptAction, Funscript } from '@/types/funscript';
import type { LibraryItem } from '../../server/types/shared';
import { createSmoothTransition } from '@/lib/patternInsertion';

/**
 * Parse funscript actions from a library item's JSON data.
 * Returns empty array if parsing fails.
 */
export function parseScriptActions(item: LibraryItem): FunscriptAction[] {
  try {
    const parsed: Funscript = JSON.parse(item.funscriptData);
    return parsed.actions ?? [];
  } catch {
    return [];
  }
}

/**
 * Prepare a looped funscript by adding a smooth transition from the
 * last action's position back to the first action's position.
 * Returns the complete funscript object and its total duration in ms.
 */
export function prepareLoopedScript(actions: FunscriptAction[]): { funscript: Funscript; durationMs: number } {
  if (actions.length === 0) {
    return { funscript: { actions: [] }, durationMs: 0 };
  }

  const lastAction = actions[actions.length - 1];
  const firstAction = actions[0];

  const transition = createSmoothTransition(
    lastAction.pos,
    firstAction.pos,
    lastAction.at,
  );

  const allActions = [...actions, ...transition];
  const durationMs = allActions.length > 0
    ? allActions[allActions.length - 1].at
    : 0;

  return {
    funscript: { actions: allActions },
    durationMs,
  };
}

/**
 * Prepare a transitioned script: smooth transition from the end of the
 * current script to the start of the next, then append the next script's
 * actions (time-shifted to follow the transition).
 */
export function prepareTransitionedScript(
  currentActions: FunscriptAction[],
  nextActions: FunscriptAction[],
): { funscript: Funscript; durationMs: number } {
  if (nextActions.length === 0) {
    return { funscript: { actions: [] }, durationMs: 0 };
  }

  const currentEndPos = currentActions.length > 0
    ? currentActions[currentActions.length - 1].pos
    : nextActions[0].pos;

  const nextStartPos = nextActions[0].pos;

  // Build transition from current end to next start
  const transition = createSmoothTransition(currentEndPos, nextStartPos, 0);

  const transitionDuration = transition.length > 0
    ? transition[transition.length - 1].at
    : 0;

  // Time-shift next actions to start after the transition
  const shiftedNext = nextActions.map(a => ({
    pos: a.pos,
    at: a.at + transitionDuration,
  }));

  const allActions = [...transition, ...shiftedNext];

  // Add loop-back transition for the combined script
  if (allActions.length > 0) {
    const lastAction = allActions[allActions.length - 1];
    const loopBack = createSmoothTransition(lastAction.pos, nextStartPos, lastAction.at);
    allActions.push(...loopBack);
  }

  const durationMs = allActions.length > 0
    ? allActions[allActions.length - 1].at
    : 0;

  return {
    funscript: { actions: allActions },
    durationMs,
  };
}

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Pick a random index from an array of the given length.
 */
export function pickRandomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}
