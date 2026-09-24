/**
 * Cuts a source script into loopable ~10 second sample windows.
 * Timing and positions are copied verbatim (only rebased to start at 0), so a
 * sample plays at exactly the speed it had in the source.
 */

import type { FunscriptActionDto } from '../../types/shared.js';

export interface WindowRules {
  targetDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  /** Fastest segment allowed, in position units per second. */
  maxSpeed: number;
  /** Longest stretch of no motion allowed, in milliseconds. */
  maxStillMs: number;
  /** Segments slower than this (units per second) count as no motion. */
  stillSpeed: number;
  /** Fewest direction changes a window needs to count as a pattern. */
  minReversals: number;
}

export interface SampleWindow {
  sourceLabel: string;
  /** Where the window starts in the source script. */
  startMs: number;
  /** The window's actions, rebased so the first is at 0. */
  actions: FunscriptActionDto[];
}

/** Speed between two actions in position units per second; 0 for simultaneous actions. */
export function segmentSpeed(from: FunscriptActionDto, to: FunscriptActionDto): number {
  const elapsedMs = to.at - from.at;
  return elapsedMs > 0 ? (Math.abs(to.pos - from.pos) / elapsedMs) * 1000 : 0;
}

/** Sort by time, drop actions that share a timestamp (the later one wins) and clamp positions. */
export function normalizeActions(actions: FunscriptActionDto[]): FunscriptActionDto[] {
  const byTime = new Map<number, number>();
  for (const action of [...actions].sort((a, b) => a.at - b.at)) {
    byTime.set(Math.round(action.at), Math.min(100, Math.max(0, Math.round(action.pos))));
  }
  return [...byTime].map(([at, pos]) => ({ at, pos }));
}

/** Indices of actions where the motion changes direction, ignoring flat holds. */
export function reversalIndices(actions: FunscriptActionDto[]): number[] {
  const reversals: number[] = [];
  let lastDirection = 0;
  let lastMoveEnd = -1;

  for (let i = 1; i < actions.length; i++) {
    const direction = Math.sign(actions[i]!.pos - actions[i - 1]!.pos);
    if (direction === 0) continue;
    if (lastDirection !== 0 && direction !== lastDirection) {
      reversals.push(lastMoveEnd);
    }
    lastDirection = direction;
    lastMoveEnd = i;
  }
  return reversals;
}

/** Durations of each consecutive run of no-motion segments. */
function stillRunsMs(actions: FunscriptActionDto[], stillSpeed: number): number[] {
  const runs: number[] = [];
  let current = 0;
  for (let i = 1; i < actions.length; i++) {
    if (segmentSpeed(actions[i - 1]!, actions[i]!) < stillSpeed) {
      current += actions[i]!.at - actions[i - 1]!.at;
    } else {
      runs.push(current);
      current = 0;
    }
  }
  runs.push(current);
  return runs;
}

/**
 * Longest no-motion stretch, counting the loop seam: a hold at the end of a
 * sample runs straight into a hold at its start when the sample repeats.
 */
export function longestStillRunMs(actions: FunscriptActionDto[], stillSpeed: number): number {
  const runs = stillRunsMs(actions, stillSpeed);
  const seam = runs.length > 1 ? runs[0]! + runs[runs.length - 1]! : runs[0]!;
  return Math.max(seam, ...runs);
}

export function maxSegmentSpeed(actions: FunscriptActionDto[]): number {
  let fastest = 0;
  for (let i = 1; i < actions.length; i++) {
    fastest = Math.max(fastest, segmentSpeed(actions[i - 1]!, actions[i]!));
  }
  return fastest;
}

function windowIsAcceptable(actions: FunscriptActionDto[], rules: WindowRules): boolean {
  return maxSegmentSpeed(actions) <= rules.maxSpeed
    && longestStillRunMs(actions, rules.stillSpeed) <= rules.maxStillMs
    && reversalIndices(actions).length >= rules.minReversals;
}

/** Lower is better: close to the target length, and ending near where it started so it loops cleanly. */
function windowScore(actions: FunscriptActionDto[], rules: WindowRules): number {
  const first = actions[0]!;
  const last = actions[actions.length - 1]!;
  const lengthError = Math.abs(last.at - first.at - rules.targetDurationMs) / 1000;
  const seamGap = Math.abs(last.pos - first.pos) / 10;
  return lengthError + seamGap;
}

/** Best acceptable window starting at `start` that ends on a reversal, or null. */
function bestWindowFrom(
  actions: FunscriptActionDto[],
  start: number,
  endPoints: ReadonlySet<number>,
  rules: WindowRules,
): FunscriptActionDto[] | null {
  const startAt = actions[start]!.at;
  let best: FunscriptActionDto[] | null = null;
  let bestScore = Infinity;

  for (let end = start + 1; end < actions.length; end++) {
    const length = actions[end]!.at - startAt;
    if (length > rules.maxDurationMs) break;
    if (length < rules.minDurationMs || !endPoints.has(end)) continue;

    const window = actions.slice(start, end + 1);
    const score = windowScore(window, rules);
    if (score < bestScore && windowIsAcceptable(window, rules)) {
      best = window;
      bestScore = score;
    }
  }
  return best;
}

function rebase(window: FunscriptActionDto[]): FunscriptActionDto[] {
  const origin = window[0]!.at;
  return window.map(action => ({ at: action.at - origin, pos: action.pos }));
}

/**
 * Tile a script into back-to-back, non-overlapping sample windows. Each window
 * starts and ends on a stroke reversal; stretches that break the rules (too
 * fast, too long without motion) are skipped rather than altered.
 */
export function tileSampleWindows(
  sourceLabel: string,
  rawActions: FunscriptActionDto[],
  rules: WindowRules,
): SampleWindow[] {
  const actions = normalizeActions(rawActions);
  const reversals = reversalIndices(actions);
  const endPoints = new Set([...reversals, actions.length - 1]);
  const startPoints = [0, ...reversals];

  const windows: SampleWindow[] = [];
  let earliestStartMs = 0;

  for (const start of startPoints) {
    if (actions[start]!.at < earliestStartMs) continue;
    const window = bestWindowFrom(actions, start, endPoints, rules);
    if (!window) continue;

    windows.push({ sourceLabel, startMs: window[0]!.at, actions: rebase(window) });
    earliestStartMs = window[window.length - 1]!.at;
  }
  return windows;
}
