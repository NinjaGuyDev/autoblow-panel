/**
 * Time-warp engine — piecewise-linear remapping of funscript timing.
 *
 * A warp is defined by speed segments expressed in *original* script time.
 * `originalToWarped` / `warpedToOriginal` convert between the script's own
 * timeline and the timeline the device actually plays back. Positions are
 * never touched: warping only moves actions along the time axis.
 */

import type { FunscriptAction } from '@/types/funscript';

/** Slowest playback the device is driven at (10% of original speed). */
export const MIN_SPEED_FACTOR = 0.1;

/** Fastest playback the device is driven at (4x original speed). */
export const MAX_SPEED_FACTOR = 4.0;

/**
 * A speed change over a range of original script time.
 * `factor` 1.0 is original speed; 2.0 plays the range twice as fast.
 * `factor` 0 marks a pause: the range must be zero-width and
 * `pauseDurationMs` says how long the position is held.
 */
export interface SpeedSegment {
  startMs: number;
  endMs: number;
  factor: number;
  pauseDurationMs?: number;
}

/** One resolved piece of the mapping, with both timelines materialised. */
export interface WarpSpan {
  originalStartMs: number;
  originalEndMs: number;
  warpedStartMs: number;
  warpedEndMs: number;
  factor: number;
}

export interface TimeWarp {
  readonly spans: readonly WarpSpan[];
  readonly originalDurationMs: number;
  readonly warpedDurationMs: number;
  /** Original script time → device playback time. */
  originalToWarped(originalMs: number): number;
  /** Device playback time → original script time. */
  warpedToOriginal(warpedMs: number): number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isPause(segment: SpeedSegment): boolean {
  return segment.factor === 0;
}

/**
 * Clamp segments into [0, durationMs], drop empty ones, and sort them.
 * Pauses sort before speed segments that start at the same instant so the
 * hold happens before the new speed takes effect.
 */
function normalizeSegments(segments: readonly SpeedSegment[], durationMs: number): SpeedSegment[] {
  const normalized: SpeedSegment[] = [];

  for (const segment of segments) {
    if (isPause(segment)) {
      const pauseDurationMs = Math.round(segment.pauseDurationMs ?? 0);
      if (pauseDurationMs <= 0) continue;
      const at = clamp(segment.startMs, 0, durationMs);
      normalized.push({ startMs: at, endMs: at, factor: 0, pauseDurationMs });
      continue;
    }

    const startMs = clamp(segment.startMs, 0, durationMs);
    const endMs = clamp(segment.endMs, 0, durationMs);
    if (endMs <= startMs) continue;

    normalized.push({
      startMs,
      endMs,
      factor: clamp(segment.factor, MIN_SPEED_FACTOR, MAX_SPEED_FACTOR),
    });
  }

  normalized.sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    return (isPause(a) ? 0 : 1) - (isPause(b) ? 0 : 1);
  });

  return normalized;
}

/** Index of the last span whose original range starts at or before `originalMs`. */
function findSpanByOriginal(spans: readonly WarpSpan[], originalMs: number): number {
  let low = 0;
  let high = spans.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const span = spans[mid]!;
    if (span.originalStartMs <= originalMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

/** Index of the first span whose warped range ends at or after `warpedMs`. */
function findSpanByWarped(spans: readonly WarpSpan[], warpedMs: number): number {
  let low = 0;
  let high = spans.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const span = spans[mid]!;
    if (span.warpedEndMs >= warpedMs) {
      found = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return found;
}

/**
 * Build a time mapping from speed segments.
 * Gaps between segments play at original speed. Times outside
 * [0, durationMs] map with an identity offset so callers can safely pass
 * actions that overrun the declared duration.
 *
 * @throws Error when two speed segments overlap.
 */
export function buildWarp(segments: readonly SpeedSegment[], durationMs: number): TimeWarp {
  const originalDurationMs = Math.max(0, durationMs);
  const normalized = normalizeSegments(segments, originalDurationMs);
  const spans: WarpSpan[] = [];

  let originalCursor = 0;
  let warpedCursor = 0;

  const pushSpan = (originalStartMs: number, originalEndMs: number, warpedWidth: number, factor: number) => {
    spans.push({
      originalStartMs,
      originalEndMs,
      warpedStartMs: warpedCursor,
      warpedEndMs: warpedCursor + warpedWidth,
      factor,
    });
    originalCursor = originalEndMs;
    warpedCursor += warpedWidth;
  };

  for (const segment of normalized) {
    if (segment.startMs < originalCursor) {
      throw new Error(
        `Overlapping speed segments: segment at ${segment.startMs}ms starts before ${originalCursor}ms`,
      );
    }

    if (segment.startMs > originalCursor) {
      pushSpan(originalCursor, segment.startMs, segment.startMs - originalCursor, 1);
    }

    if (isPause(segment)) {
      pushSpan(segment.startMs, segment.startMs, segment.pauseDurationMs ?? 0, 0);
      continue;
    }

    pushSpan(segment.startMs, segment.endMs, (segment.endMs - segment.startMs) / segment.factor, segment.factor);
  }

  if (originalCursor < originalDurationMs) {
    pushSpan(originalCursor, originalDurationMs, originalDurationMs - originalCursor, 1);
  }

  const warpedDurationMs = warpedCursor;

  function originalToWarped(originalMs: number): number {
    if (originalMs <= 0) return originalMs;
    if (originalMs >= originalDurationMs) return warpedDurationMs + (originalMs - originalDurationMs);

    const index = findSpanByOriginal(spans, originalMs);
    if (index < 0) return originalMs;

    const span = spans[index]!;
    const originalWidth = span.originalEndMs - span.originalStartMs;
    // Zero-width spans are pauses; land on the far side so playback resumes moving.
    if (originalWidth === 0) return span.warpedEndMs;

    const warpedWidth = span.warpedEndMs - span.warpedStartMs;
    return span.warpedStartMs + ((originalMs - span.originalStartMs) / originalWidth) * warpedWidth;
  }

  function warpedToOriginal(warpedMs: number): number {
    if (warpedMs <= 0) return warpedMs;
    if (warpedMs >= warpedDurationMs) return originalDurationMs + (warpedMs - warpedDurationMs);

    const index = findSpanByWarped(spans, warpedMs);
    if (index < 0) return warpedMs;

    const span = spans[index]!;
    const warpedWidth = span.warpedEndMs - span.warpedStartMs;
    if (warpedWidth === 0) return span.originalStartMs;

    const originalWidth = span.originalEndMs - span.originalStartMs;
    return span.originalStartMs + ((warpedMs - span.warpedStartMs) / warpedWidth) * originalWidth;
  }

  return { spans, originalDurationMs, warpedDurationMs, originalToWarped, warpedToOriginal };
}

/** Build a warp that scales the whole script by a single factor. */
export function buildUniformWarp(durationMs: number, factor: number): TimeWarp {
  return buildWarp([{ startMs: 0, endMs: durationMs, factor }], durationMs);
}

/** Linearly interpolated position at an arbitrary original time. */
function positionAt(actions: readonly FunscriptAction[], timeMs: number): number | null {
  if (actions.length === 0) return null;

  const first = actions[0]!;
  if (timeMs <= first.at) return first.pos;

  const last = actions[actions.length - 1]!;
  if (timeMs >= last.at) return last.pos;

  for (let i = 1; i < actions.length; i++) {
    const next = actions[i]!;
    if (next.at < timeMs) continue;

    const previous = actions[i - 1]!;
    const span = next.at - previous.at;
    if (span <= 0) return next.pos;
    const ratio = (timeMs - previous.at) / span;
    return Math.round(previous.pos + (next.pos - previous.pos) * ratio);
  }

  return last.pos;
}

/**
 * Drop actions that collapsed onto an earlier action's millisecond.
 * Rounding at high speed factors can make neighbouring actions share an `at`,
 * and the device requires strictly increasing timestamps.
 */
function enforceStrictlyIncreasing(actions: readonly FunscriptAction[]): FunscriptAction[] {
  const result: FunscriptAction[] = [];

  for (const action of actions) {
    const previous = result[result.length - 1];
    if (previous !== undefined && action.at <= previous.at) continue;
    result.push(action);
  }

  return result;
}

/**
 * Remap actions onto the warped timeline.
 * Pauses insert a hold: the interpolated position is repeated at the start and
 * end of the pause so the device stays still for its duration.
 */
export function applyWarp(actions: readonly FunscriptAction[], warp: TimeWarp): FunscriptAction[] {
  if (actions.length === 0) return [];

  const mapped: FunscriptAction[] = actions.map(action => ({
    pos: action.pos,
    at: Math.max(0, Math.round(warp.originalToWarped(action.at))),
  }));

  for (const span of warp.spans) {
    if (span.factor !== 0) continue;
    const holdPos = positionAt(actions, span.originalStartMs);
    if (holdPos === null) continue;
    mapped.push(
      { pos: holdPos, at: Math.max(0, Math.round(span.warpedStartMs)) },
      { pos: holdPos, at: Math.max(0, Math.round(span.warpedEndMs)) },
    );
  }

  mapped.sort((a, b) => a.at - b.at);
  return enforceStrictlyIncreasing(mapped);
}

/** Rescale a whole script by a single speed factor. */
export function applySpeedFactor(actions: readonly FunscriptAction[], factor: number): FunscriptAction[] {
  if (actions.length === 0) return [];
  const durationMs = actions[actions.length - 1]!.at;
  return applyWarp(actions, buildUniformWarp(durationMs, factor));
}
