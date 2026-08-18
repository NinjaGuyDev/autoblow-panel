import { describe, it, expect } from 'vitest';
import type { ScriptModDefinition } from '@server/types/shared';
import { compileMod, resolveDuration } from '../modCompiler';
import { createSeededRng } from '../seededRng';
import { applyWarp, buildWarp, MAX_SPEED_FACTOR, MIN_SPEED_FACTOR, type SpeedSegment } from '../timeWarp';
import type { FunscriptAction } from '@/types/funscript';

const SCRIPT_DURATION_MS = 300_000; // 5 minutes

/**
 * Example 1 from the feature plan:
 * "Randomly increase the speed by 2x for 4 to 10 seconds, followed by a change
 * to 75% of the original speed for 8 seconds before returning to the script's
 * original speed."
 */
const BURST_MOD: ScriptModDefinition = {
  version: 1,
  kind: 'sequence-burst',
  ops: [
    { op: 'speed', factor: 2.0, durationMs: { min: 4_000, max: 10_000 } },
    { op: 'speed', factor: 0.75, durationMs: { fixed: 8_000 } },
  ],
  trigger: { type: 'random', minGapMs: 15_000 },
};

/**
 * Example 2 from the feature plan:
 * "Without going more than 2x the speed or less than 75% of the original speed,
 * randomly vary the speed every 5 to 20 seconds, with 2-second pauses at random
 * intervals (not more than 1 pause every 5 seconds)."
 */
const CHAOS_MOD: ScriptModDefinition = {
  version: 1,
  kind: 'continuous',
  ops: [
    { op: 'randomSpeed', range: [0.75, 2.0], holdMs: { min: 5_000, max: 20_000 } },
    { op: 'pause', durationMs: { fixed: 2_000 }, minGapMs: 5_000, probabilityPerWindow: 0.5 },
  ],
  trigger: null,
};

function speedSegments(segments: SpeedSegment[]): SpeedSegment[] {
  return segments.filter(segment => segment.factor !== 0);
}

function pauseSegments(segments: SpeedSegment[]): SpeedSegment[] {
  return segments.filter(segment => segment.factor === 0);
}

function expectNonOverlapping(segments: SpeedSegment[]): void {
  let cursor = 0;
  for (const segment of segments) {
    expect(segment.startMs).toBeGreaterThanOrEqual(cursor);
    expect(segment.endMs).toBeGreaterThanOrEqual(segment.startMs);
    cursor = segment.endMs;
  }
}

describe('resolveDuration', () => {
  it('returns the fixed value without consuming randomness', () => {
    const rng = createSeededRng(1);
    expect(resolveDuration({ fixed: 8_000 }, rng)).toBe(8_000);
    // The RNG is untouched, so the next draw is still the first of the sequence
    expect(rng()).toBe(createSeededRng(1)());
  });

  it('draws uniformly from [min, max]', () => {
    const rng = createSeededRng(42);
    for (let i = 0; i < 100; i++) {
      const value = resolveDuration({ min: 4_000, max: 10_000 }, rng);
      expect(value).toBeGreaterThanOrEqual(4_000);
      expect(value).toBeLessThanOrEqual(10_000);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('tolerates a reversed min/max pair', () => {
    const value = resolveDuration({ min: 10_000, max: 4_000 }, createSeededRng(7));
    expect(value).toBeGreaterThanOrEqual(4_000);
    expect(value).toBeLessThanOrEqual(10_000);
  });

  it('returns 0 when neither form is supplied', () => {
    expect(resolveDuration({}, createSeededRng(1))).toBe(0);
  });
});

describe('compileMod — general behaviour', () => {
  it('returns nothing for a zero-length script', () => {
    expect(compileMod(CHAOS_MOD, 0, createSeededRng(1))).toEqual([]);
  });

  it('is deterministic for a given seed', () => {
    expect(compileMod(CHAOS_MOD, SCRIPT_DURATION_MS, createSeededRng(99)))
      .toEqual(compileMod(CHAOS_MOD, SCRIPT_DURATION_MS, createSeededRng(99)));
    expect(compileMod(BURST_MOD, SCRIPT_DURATION_MS, createSeededRng(99)))
      .toEqual(compileMod(BURST_MOD, SCRIPT_DURATION_MS, createSeededRng(99)));
  });

  it('produces different output for different seeds', () => {
    expect(compileMod(CHAOS_MOD, SCRIPT_DURATION_MS, createSeededRng(1)))
      .not.toEqual(compileMod(CHAOS_MOD, SCRIPT_DURATION_MS, createSeededRng(2)));
  });

  it('returns nothing when a sequence-burst mod has no trigger', () => {
    const noTrigger: ScriptModDefinition = { ...BURST_MOD, trigger: null };
    expect(compileMod(noTrigger, SCRIPT_DURATION_MS, createSeededRng(1))).toEqual([]);
  });

  it('terminates when every op resolves to a zero-length hold', () => {
    const degenerate: ScriptModDefinition = {
      version: 1,
      kind: 'continuous',
      ops: [{ op: 'speed', factor: 2, durationMs: { fixed: 0 } }],
      trigger: null,
    };
    expect(compileMod(degenerate, SCRIPT_DURATION_MS, createSeededRng(1))).toEqual([]);
  });
});

describe('compileMod — example 1 (sequence-burst)', () => {
  const segments = compileMod(BURST_MOD, SCRIPT_DURATION_MS, createSeededRng(2026));

  it('emits 2x then 0.75x pairs', () => {
    expect(segments.length).toBeGreaterThan(2);

    // The trailing burst may be cut short by the end of the script
    const completePairs = Math.floor(segments.length / 2);

    for (let i = 0; i < completePairs * 2; i += 2) {
      const fast = segments[i]!;
      const slow = segments[i + 1]!;

      expect(fast.factor).toBe(2.0);
      expect(fast.endMs - fast.startMs).toBeGreaterThanOrEqual(4_000);
      expect(fast.endMs - fast.startMs).toBeLessThanOrEqual(10_000);

      expect(slow.factor).toBe(0.75);
      expect(slow.startMs).toBe(fast.endMs);
      expect(slow.endMs).toBe(Math.min(SCRIPT_DURATION_MS, slow.startMs + 8_000));
    }

    if (segments.length % 2 === 1) {
      const truncated = segments[segments.length - 1]!;
      expect(truncated.factor).toBe(2.0);
      expect(truncated.endMs).toBe(SCRIPT_DURATION_MS);
    }
  });

  it('leaves at least the trigger gap between bursts', () => {
    for (let i = 2; i + 1 < segments.length; i += 2) {
      const previousBurstEnd = segments[i - 1]!.endMs;
      expect(segments[i]!.startMs - previousBurstEnd).toBeGreaterThanOrEqual(15_000);
    }
  });

  it('never starts a burst before the first trigger gap', () => {
    expect(segments[0]!.startMs).toBeGreaterThanOrEqual(15_000);
  });

  it('stays inside the script and does not overlap', () => {
    expectNonOverlapping(segments);
    expect(segments[segments.length - 1]!.endMs).toBeLessThanOrEqual(SCRIPT_DURATION_MS);
  });

  it('builds a warp that shortens the script (net speed-up)', () => {
    const warp = buildWarp(segments, SCRIPT_DURATION_MS);
    expect(warp.warpedDurationMs).toBeLessThan(SCRIPT_DURATION_MS);
  });
});

describe('compileMod — example 2 (continuous)', () => {
  const segments = compileMod(CHAOS_MOD, SCRIPT_DURATION_MS, createSeededRng(2026));

  it('covers the whole script with speed segments', () => {
    const speeds = speedSegments(segments);
    expect(speeds[0]!.startMs).toBe(0);
    expect(speeds[speeds.length - 1]!.endMs).toBe(SCRIPT_DURATION_MS);

    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]!.startMs).toBe(speeds[i - 1]!.endMs);
    }
  });

  it('honours the speed range bounds', () => {
    for (const segment of speedSegments(segments)) {
      expect(segment.factor).toBeGreaterThanOrEqual(0.75);
      expect(segment.factor).toBeLessThanOrEqual(2.0);
    }
  });

  it('holds each drawn speed for 5-20 s, except where a pause splits it', () => {
    // Adjacent segments sharing a factor are one hold that a pause cut in two
    const holds: number[] = [];
    let holdMs = 0;
    let holdFactor: number | null = null;

    for (const segment of speedSegments(segments)) {
      if (segment.factor !== holdFactor) {
        if (holdFactor !== null) holds.push(holdMs);
        holdFactor = segment.factor;
        holdMs = 0;
      }
      holdMs += segment.endMs - segment.startMs;
    }
    if (holdFactor !== null) holds.push(holdMs);

    // The final hold is truncated by the end of the script
    for (const hold of holds.slice(0, -1)) {
      expect(hold).toBeGreaterThanOrEqual(5_000);
      expect(hold).toBeLessThanOrEqual(20_000);
    }
  });

  it('emits 2 s pauses no closer together than 5 s', () => {
    const pauses = pauseSegments(segments);
    expect(pauses.length).toBeGreaterThan(0);

    for (const pause of pauses) {
      expect(pause.pauseDurationMs).toBe(2_000);
      expect(pause.startMs).toBe(pause.endMs);
    }

    for (let i = 1; i < pauses.length; i++) {
      expect(pauses[i]!.startMs - pauses[i - 1]!.startMs).toBeGreaterThanOrEqual(5_000);
    }
  });

  it('produces segments buildWarp accepts', () => {
    expect(() => buildWarp(segments, SCRIPT_DURATION_MS)).not.toThrow();
  });

  it('adds the pause time to the warped duration', () => {
    const warp = buildWarp(segments, SCRIPT_DURATION_MS);
    const totalPauseMs = pauseSegments(segments)
      .reduce((sum, pause) => sum + (pause.pauseDurationMs ?? 0), 0);

    expect(totalPauseMs).toBeGreaterThan(0);
    expect(warp.warpedDurationMs).toBeGreaterThan(totalPauseMs);
  });
});

describe('compileMod — warped output invariants', () => {
  /** One action every 250 ms for the whole script. */
  const actions: FunscriptAction[] = Array.from(
    { length: SCRIPT_DURATION_MS / 250 + 1 },
    (_, i) => ({ pos: i % 2 === 0 ? 10 : 90, at: i * 250 }),
  );

  it.each([
    ['sequence-burst', BURST_MOD],
    ['continuous', CHAOS_MOD],
  ])('keeps `at` integer and strictly increasing for a %s mod', (_kind, definition) => {
    const warp = buildWarp(compileMod(definition, SCRIPT_DURATION_MS, createSeededRng(7)), SCRIPT_DURATION_MS);
    const warped = applyWarp(actions, warp);

    expect(warped.length).toBeGreaterThan(0);
    for (let i = 0; i < warped.length; i++) {
      const action = warped[i]!;
      expect(Number.isInteger(action.at)).toBe(true);
      expect(action.pos).toBeGreaterThanOrEqual(0);
      expect(action.pos).toBeLessThanOrEqual(100);
      if (i > 0) expect(action.at).toBeGreaterThan(warped[i - 1]!.at);
    }
  });

  it('clamps out-of-range factors to the engine bounds', () => {
    const extreme: ScriptModDefinition = {
      version: 1,
      kind: 'continuous',
      ops: [{ op: 'randomSpeed', range: [-50, 900], holdMs: { fixed: 5_000 } }],
      trigger: null,
    };

    for (const segment of compileMod(extreme, 60_000, createSeededRng(3))) {
      expect(segment.factor).toBeGreaterThanOrEqual(MIN_SPEED_FACTOR);
      expect(segment.factor).toBeLessThanOrEqual(MAX_SPEED_FACTOR);
    }
  });
});
