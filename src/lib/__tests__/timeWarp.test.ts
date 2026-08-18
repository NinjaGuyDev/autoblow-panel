import { describe, it, expect } from 'vitest';
import {
  applySpeedFactor,
  applyWarp,
  buildUniformWarp,
  buildWarp,
  MAX_SPEED_FACTOR,
  MIN_SPEED_FACTOR,
  type SpeedSegment,
} from '../timeWarp';
import type { FunscriptAction } from '@/types/funscript';

/** Ramp of actions 100 ms apart alternating between 0 and 100. */
function makeActions(count: number, stepMs = 100): FunscriptAction[] {
  return Array.from({ length: count }, (_, i) => ({
    pos: i % 2 === 0 ? 0 : 100,
    at: i * stepMs,
  }));
}

function expectStrictlyIncreasingIntegers(actions: FunscriptAction[]): void {
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    expect(Number.isInteger(action.at)).toBe(true);
    if (i > 0) {
      expect(action.at).toBeGreaterThan(actions[i - 1]!.at);
    }
  }
}

describe('buildWarp', () => {
  it('is the identity when there are no segments', () => {
    const warp = buildWarp([], 10_000);

    expect(warp.warpedDurationMs).toBe(10_000);
    expect(warp.originalToWarped(0)).toBe(0);
    expect(warp.originalToWarped(4_321)).toBe(4_321);
    expect(warp.warpedToOriginal(4_321)).toBe(4_321);
  });

  it('halves the warped duration at double speed', () => {
    const warp = buildUniformWarp(10_000, 2);

    expect(warp.warpedDurationMs).toBe(5_000);
    expect(warp.originalToWarped(10_000)).toBe(5_000);
    expect(warp.originalToWarped(2_500)).toBe(1_250);
    expect(warp.warpedToOriginal(1_250)).toBe(2_500);
  });

  it('doubles the warped duration at half speed', () => {
    const warp = buildUniformWarp(10_000, 0.5);

    expect(warp.warpedDurationMs).toBe(20_000);
    expect(warp.originalToWarped(5_000)).toBe(10_000);
    expect(warp.warpedToOriginal(10_000)).toBe(5_000);
  });

  it('plays gaps between segments at original speed', () => {
    const warp = buildWarp([{ startMs: 4_000, endMs: 6_000, factor: 2 }], 10_000);

    // 4 s original + 1 s (2 s at 2x) + 4 s original
    expect(warp.warpedDurationMs).toBe(9_000);
    expect(warp.originalToWarped(4_000)).toBe(4_000);
    expect(warp.originalToWarped(6_000)).toBe(5_000);
    expect(warp.originalToWarped(10_000)).toBe(9_000);
  });

  it('round-trips original -> warped -> original', () => {
    const warp = buildWarp(
      [
        { startMs: 0, endMs: 3_000, factor: 1.5 },
        { startMs: 5_000, endMs: 9_000, factor: 0.5 },
      ],
      12_000,
    );

    for (const originalMs of [0, 1_500, 3_000, 4_000, 5_000, 7_000, 9_000, 11_000, 12_000]) {
      expect(warp.warpedToOriginal(warp.originalToWarped(originalMs))).toBeCloseTo(originalMs, 6);
    }
  });

  it('adds pause duration to warped time without consuming original time', () => {
    const pause: SpeedSegment = { startMs: 5_000, endMs: 5_000, factor: 0, pauseDurationMs: 2_000 };
    const warp = buildWarp([pause], 10_000);

    expect(warp.warpedDurationMs).toBe(12_000);
    // Everything before the pause is untouched
    expect(warp.originalToWarped(4_999)).toBe(4_999);
    // Seeking to the pause instant lands on the far side so playback keeps moving
    expect(warp.originalToWarped(5_000)).toBe(7_000);
    expect(warp.originalToWarped(6_000)).toBe(8_000);
    // The whole pause window maps back to the frozen instant
    expect(warp.warpedToOriginal(5_000)).toBe(5_000);
    expect(warp.warpedToOriginal(6_000)).toBe(5_000);
    expect(warp.warpedToOriginal(7_000)).toBe(5_000);
  });

  it('clamps factors into the supported range', () => {
    expect(buildUniformWarp(1_000, 99).warpedDurationMs).toBe(1_000 / MAX_SPEED_FACTOR);
    expect(buildUniformWarp(1_000, 0.001).warpedDurationMs).toBe(1_000 / MIN_SPEED_FACTOR);
  });

  it('clamps segments that run past the script duration', () => {
    const warp = buildWarp([{ startMs: 0, endMs: 50_000, factor: 2 }], 10_000);
    expect(warp.warpedDurationMs).toBe(5_000);
  });

  it('extends the mapping past the declared duration with an identity offset', () => {
    const warp = buildUniformWarp(10_000, 2);
    expect(warp.originalToWarped(12_000)).toBe(7_000);
    expect(warp.warpedToOriginal(7_000)).toBe(12_000);
  });

  it('throws when speed segments overlap', () => {
    expect(() =>
      buildWarp(
        [
          { startMs: 0, endMs: 5_000, factor: 2 },
          { startMs: 4_000, endMs: 8_000, factor: 0.5 },
        ],
        10_000,
      ),
    ).toThrow(/Overlapping speed segments/);
  });

  it('accepts unsorted input', () => {
    const warp = buildWarp(
      [
        { startMs: 6_000, endMs: 8_000, factor: 2 },
        { startMs: 0, endMs: 2_000, factor: 2 },
      ],
      10_000,
    );
    expect(warp.warpedDurationMs).toBe(8_000);
  });

  it('handles a zero-length script', () => {
    const warp = buildWarp([], 0);
    expect(warp.warpedDurationMs).toBe(0);
    expect(warp.originalToWarped(0)).toBe(0);
  });
});

describe('applyWarp', () => {
  it('returns an empty array for no actions', () => {
    expect(applyWarp([], buildUniformWarp(1_000, 2))).toEqual([]);
  });

  it('leaves positions untouched and only moves time', () => {
    const actions = makeActions(5);
    const warped = applyWarp(actions, buildUniformWarp(400, 2));

    expect(warped.map(a => a.pos)).toEqual(actions.map(a => a.pos));
    expect(warped.map(a => a.at)).toEqual([0, 50, 100, 150, 200]);
  });

  it('inserts a hold across a pause', () => {
    const actions: FunscriptAction[] = [
      { pos: 0, at: 0 },
      { pos: 100, at: 1_000 },
      { pos: 0, at: 2_000 },
    ];
    const warp = buildWarp(
      [{ startMs: 1_000, endMs: 1_000, factor: 0, pauseDurationMs: 500 }],
      2_000,
    );

    const warped = applyWarp(actions, warp);

    expect(warped).toEqual([
      { pos: 0, at: 0 },
      { pos: 100, at: 1_000 },
      { pos: 100, at: 1_500 },
      { pos: 0, at: 2_500 },
    ]);
    expectStrictlyIncreasingIntegers(warped);
  });

  it('interpolates the hold position when the pause falls between actions', () => {
    const actions: FunscriptAction[] = [
      { pos: 0, at: 0 },
      { pos: 100, at: 1_000 },
    ];
    const warp = buildWarp(
      [{ startMs: 500, endMs: 500, factor: 0, pauseDurationMs: 400 }],
      1_000,
    );

    const warped = applyWarp(actions, warp);

    expect(warped).toEqual([
      { pos: 0, at: 0 },
      { pos: 50, at: 500 },
      { pos: 50, at: 900 },
      { pos: 100, at: 1_400 },
    ]);
  });

  it('keeps `at` integer and strictly increasing under extreme compression', () => {
    const actions = makeActions(200, 1);
    const warped = applyWarp(actions, buildUniformWarp(199, MAX_SPEED_FACTOR));

    expect(warped.length).toBeGreaterThan(0);
    expectStrictlyIncreasingIntegers(warped);
  });

  it('keeps `at` integer and strictly increasing for a mixed warp', () => {
    const actions = makeActions(120, 37);
    const warp = buildWarp(
      [
        { startMs: 0, endMs: 1_000, factor: 3.7 },
        { startMs: 1_000, endMs: 1_000, factor: 0, pauseDurationMs: 1_500 },
        { startMs: 2_000, endMs: 3_000, factor: 0.3 },
      ],
      120 * 37,
    );

    expectStrictlyIncreasingIntegers(applyWarp(actions, warp));
  });
});

describe('applySpeedFactor', () => {
  it('returns an empty array for no actions', () => {
    expect(applySpeedFactor([], 2)).toEqual([]);
  });

  it('is a no-op at factor 1', () => {
    const actions = makeActions(6);
    expect(applySpeedFactor(actions, 1)).toEqual(actions);
  });

  it('does not compound when derived twice from the pristine actions', () => {
    const actions = makeActions(6);

    const once = applySpeedFactor(actions, 1.6);
    const fromPristineAgain = applySpeedFactor(actions, 1.6);
    const compounded = applySpeedFactor(applySpeedFactor(actions, 1.3), 1.6);

    expect(fromPristineAgain).toEqual(once);
    expect(compounded).not.toEqual(once);
  });

  it('stretches the script when slowed down', () => {
    const actions = makeActions(3);
    const warped = applySpeedFactor(actions, 0.5);
    expect(warped.map(a => a.at)).toEqual([0, 200, 400]);
  });
});
