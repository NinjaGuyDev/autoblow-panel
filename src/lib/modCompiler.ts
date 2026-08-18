/**
 * Mod compiler — turns a saved mod definition into speed segments for the
 * time-warp engine. Compilation is pure and deterministic given an RNG, so a
 * mod can be re-rolled per loop at runtime and replayed exactly in tests.
 */

import type {
  ModDurationSpec,
  ModPauseOp,
  ModRandomSpeedOp,
  ModSpeedOp,
  ScriptModDefinition,
  ScriptModOp,
} from '@server/types/shared';
import type { RandomSource } from '@/lib/seededRng';
import { MAX_SPEED_FACTOR, MIN_SPEED_FACTOR, type SpeedSegment } from '@/lib/timeWarp';

/** Ops that consume script time and set a speed. */
type TimelineOp = ModSpeedOp | ModRandomSpeedOp;

function isTimelineOp(op: ScriptModOp): op is TimelineOp {
  return op.op === 'speed' || op.op === 'randomSpeed';
}

function isPauseOp(op: ScriptModOp): op is ModPauseOp {
  return op.op === 'pause';
}

function clampFactor(factor: number): number {
  return Math.min(MAX_SPEED_FACTOR, Math.max(MIN_SPEED_FACTOR, factor));
}

/** Draw a duration from a spec. Returns 0 when the spec is unusable. */
export function resolveDuration(spec: ModDurationSpec, rng: RandomSource): number {
  if (spec.fixed !== undefined && spec.fixed !== null) {
    return Math.max(0, Math.round(spec.fixed));
  }

  const min = spec.min ?? null;
  const max = spec.max ?? null;
  if (min === null || max === null) return 0;

  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.max(0, Math.round(low + rng() * (high - low)));
}

/** Resolve a timeline op into the concrete factor and length it occupies. */
function resolveTimelineOp(op: TimelineOp, rng: RandomSource): { factor: number; durationMs: number } {
  if (op.op === 'speed') {
    return { factor: clampFactor(op.factor), durationMs: resolveDuration(op.durationMs, rng) };
  }

  const low = op.range[0] ?? MIN_SPEED_FACTOR;
  const high = op.range[1] ?? MAX_SPEED_FACTOR;
  const drawn = Math.min(low, high) + rng() * Math.abs(high - low);
  return { factor: clampFactor(drawn), durationMs: resolveDuration(op.holdMs, rng) };
}

/**
 * Fill [0, scriptDurationMs) by cycling through the timeline ops in order.
 * Ops that resolve to a zero-length hold are skipped; if none of them can
 * advance the cursor the fill stops rather than looping forever.
 */
function compileContinuousTimeline(
  ops: readonly TimelineOp[],
  scriptDurationMs: number,
  rng: RandomSource,
): SpeedSegment[] {
  const segments: SpeedSegment[] = [];
  if (ops.length === 0) return segments;

  let cursor = 0;
  let index = 0;
  let barrenRun = 0;

  while (cursor < scriptDurationMs && barrenRun < ops.length) {
    const op = ops[index % ops.length]!;
    index++;

    const { factor, durationMs } = resolveTimelineOp(op, rng);
    if (durationMs <= 0) {
      barrenRun++;
      continue;
    }
    barrenRun = 0;

    const endMs = Math.min(scriptDurationMs, cursor + durationMs);
    if (endMs > cursor) {
      segments.push({ startMs: cursor, endMs, factor });
      cursor = endMs;
    }
  }

  return segments;
}

/**
 * Scatter pauses across the script. Each `minGapMs` window offers one pause,
 * taken with `probabilityPerWindow`, which enforces the "at most one pause per
 * N seconds" constraint by construction.
 */
function compilePauseOverlay(
  ops: readonly ModPauseOp[],
  scriptDurationMs: number,
  rng: RandomSource,
): SpeedSegment[] {
  const segments: SpeedSegment[] = [];

  for (const op of ops) {
    const windowMs = Math.round(op.minGapMs);
    if (windowMs <= 0) continue;

    for (let at = windowMs; at < scriptDurationMs; at += windowMs) {
      if (rng() >= op.probabilityPerWindow) continue;
      const pauseDurationMs = resolveDuration(op.durationMs, rng);
      if (pauseDurationMs <= 0) continue;
      segments.push({ startMs: at, endMs: at, factor: 0, pauseDurationMs });
    }
  }

  return segments;
}

/**
 * Split speed segments at every pause instant.
 * `buildWarp` requires non-overlapping segments, and a pause is a zero-width
 * segment — so any speed segment straddling one has to be cut in two.
 */
function splitTimelineAtPauses(
  timeline: readonly SpeedSegment[],
  pauses: readonly SpeedSegment[],
): SpeedSegment[] {
  if (pauses.length === 0) return [...timeline];

  const points = [...new Set(pauses.map(pause => pause.startMs))].sort((a, b) => a - b);
  const result: SpeedSegment[] = [];

  for (const segment of timeline) {
    let startMs = segment.startMs;
    for (const point of points) {
      if (point <= startMs || point >= segment.endMs) continue;
      result.push({ startMs, endMs: point, factor: segment.factor });
      startMs = point;
    }
    result.push({ startMs, endMs: segment.endMs, factor: segment.factor });
  }

  return result;
}

/**
 * Run the op list as one burst starting at `startMs`.
 * Returns the segments produced and the original time the burst ended at.
 */
function compileBurst(
  ops: readonly ScriptModOp[],
  startMs: number,
  scriptDurationMs: number,
  rng: RandomSource,
): { segments: SpeedSegment[]; endMs: number } {
  const segments: SpeedSegment[] = [];
  let cursor = startMs;

  for (const op of ops) {
    if (cursor >= scriptDurationMs) break;

    if (isPauseOp(op)) {
      const pauseDurationMs = resolveDuration(op.durationMs, rng);
      if (pauseDurationMs > 0) {
        segments.push({ startMs: cursor, endMs: cursor, factor: 0, pauseDurationMs });
      }
      continue;
    }

    const { factor, durationMs } = resolveTimelineOp(op, rng);
    if (durationMs <= 0) continue;

    const endMs = Math.min(scriptDurationMs, cursor + durationMs);
    if (endMs > cursor) {
      segments.push({ startMs: cursor, endMs, factor });
      cursor = endMs;
    }
  }

  return { segments, endMs: cursor };
}

/**
 * Place repeated bursts, separated by a gap drawn uniformly from
 * [minGapMs, 2 x minGapMs) so bursts never land closer than the trigger allows.
 */
function compileSequenceBursts(
  definition: ScriptModDefinition,
  scriptDurationMs: number,
  rng: RandomSource,
): SpeedSegment[] {
  const segments: SpeedSegment[] = [];
  const minGapMs = Math.round(definition.trigger?.minGapMs ?? 0);
  if (minGapMs <= 0 || definition.ops.length === 0) return segments;

  const nextGap = () => minGapMs + Math.round(rng() * minGapMs);

  let cursor = nextGap();

  while (cursor < scriptDurationMs) {
    const burst = compileBurst(definition.ops, cursor, scriptDurationMs, rng);
    segments.push(...burst.segments);

    // A burst made entirely of pauses leaves the cursor put; step past it anyway.
    cursor = Math.max(burst.endMs, cursor + 1) + nextGap();
  }

  return segments;
}

/** Timeline ops fill the script; pause ops are scattered over the result. */
function compileContinuous(
  definition: ScriptModDefinition,
  scriptDurationMs: number,
  rng: RandomSource,
): SpeedSegment[] {
  const timeline = compileContinuousTimeline(definition.ops.filter(isTimelineOp), scriptDurationMs, rng);
  const pauses = compilePauseOverlay(definition.ops.filter(isPauseOp), scriptDurationMs, rng);
  return [...splitTimelineAtPauses(timeline, pauses), ...pauses];
}

/**
 * Compile a mod definition against a script of the given length.
 * The result is sorted and safe to hand straight to `buildWarp`.
 */
export function compileMod(
  definition: ScriptModDefinition,
  scriptDurationMs: number,
  rng: RandomSource,
): SpeedSegment[] {
  if (scriptDurationMs <= 0) return [];

  const segments = definition.kind === 'continuous'
    ? compileContinuous(definition, scriptDurationMs, rng)
    : compileSequenceBursts(definition, scriptDurationMs, rng);

  segments.sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    return (a.factor === 0 ? 0 : 1) - (b.factor === 0 ? 0 : 1);
  });

  return segments;
}
