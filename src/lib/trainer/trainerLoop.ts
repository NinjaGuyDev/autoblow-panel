/**
 * Builds the funscript the device loops while a trainer pattern plays.
 * The pattern itself is untouched; the only added motion is a lead-in from
 * wherever the previous pattern left off and a seam back to the pattern's
 * start, both at a gentle, capped speed.
 */

import type { FunscriptAction } from '@/types/funscript';
import { TRAINER_MAX_SPEED } from '@server/types/shared';

/** Speed of the lead-in and loop seam, in position units per second. */
export const JOIN_SPEED = Math.min(100, TRAINER_MAX_SPEED);
const MIN_JOIN_MS = 100;

export interface TrainerLoop {
  actions: FunscriptAction[];
  durationMs: number;
  /** Time spent moving from the previous pattern's end to this pattern's start. */
  leadInMs: number;
}

/** Time to move between two positions at JOIN_SPEED. */
export function joinDurationMs(fromPos: number, toPos: number): number {
  return Math.max(MIN_JOIN_MS, Math.ceil((Math.abs(toPos - fromPos) / JOIN_SPEED) * 1000));
}

/**
 * @param fromPos where the device is when this loop starts, or null when unknown
 *   (a fresh start) — a lead-in is added only when it differs from the pattern's start
 */
export function buildTrainerLoop(pattern: readonly FunscriptAction[], fromPos: number | null): TrainerLoop {
  if (pattern.length === 0) return { actions: [], durationMs: 0, leadInMs: 0 };

  const first = pattern[0]!;
  const needsLeadIn = fromPos !== null && fromPos !== first.pos;
  const leadInMs = needsLeadIn ? joinDurationMs(fromPos, first.pos) : 0;

  const actions: FunscriptAction[] = needsLeadIn ? [{ at: 0, pos: fromPos }] : [];
  for (const action of pattern) {
    actions.push({ at: action.at - first.at + leadInMs, pos: action.pos });
  }

  const last = actions[actions.length - 1]!;
  if (last.pos !== first.pos) {
    actions.push({ at: last.at + joinDurationMs(last.pos, first.pos), pos: first.pos });
  }

  return { actions, durationMs: actions[actions.length - 1]!.at, leadInMs };
}

/** Where the device rests when a loop finishes. */
export function loopEndPosition(loop: TrainerLoop): number | null {
  return loop.actions[loop.actions.length - 1]?.pos ?? null;
}
