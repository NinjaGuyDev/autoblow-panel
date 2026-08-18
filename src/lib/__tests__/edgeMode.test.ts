import { describe, it, expect } from 'vitest';
import {
  EDGE_MODE_PHASES,
  compileEdgeMode,
  edgeModeEndOriginalMs,
  edgeModeWallDurationMs,
  type EdgePhase,
} from '../edgeMode';
import { applyWarp, buildWarp } from '../timeWarp';
import type { FunscriptAction } from '@/types/funscript';

const SCRIPT_DURATION_MS = 600_000; // 10 minutes — long enough for the whole program

/** Original-time ms the default program consumes: 15s + 22s + 18.75s. */
const PROGRAM_ORIGINAL_MS = 55_750;

function warpOf(segments: ReturnType<typeof compileEdgeMode>) {
  return buildWarp(segments, SCRIPT_DURATION_MS);
}

describe('edgeModeWallDurationMs', () => {
  it('totals 3m30s for the default program', () => {
    expect(edgeModeWallDurationMs()).toBe(210_000);
  });
});

describe('compileEdgeMode', () => {
  it('produces segments buildWarp accepts', () => {
    expect(() => warpOf(compileEdgeMode(0, SCRIPT_DURATION_MS))).not.toThrow();
  });

  it('lasts exactly 3m30s of wall-clock time', () => {
    const segments = compileEdgeMode(0, SCRIPT_DURATION_MS);
    const warp = warpOf(segments);

    const endOriginalMs = edgeModeEndOriginalMs(segments, 0);
    expect(warp.originalToWarped(endOriginalMs)).toBeCloseTo(210_000, 6);
  });

  it('consumes only the script time the slowed phases cover', () => {
    const segments = compileEdgeMode(0, SCRIPT_DURATION_MS);

    expect(edgeModeEndOriginalMs(segments, 0)).toBeCloseTo(PROGRAM_ORIGINAL_MS, 6);
  });

  it('runs each phase for its stated wall-clock duration', () => {
    const segments = compileEdgeMode(0, SCRIPT_DURATION_MS);
    const warp = warpOf(segments);

    let cursorOriginalMs = 0;
    let elapsedWallMs = 0;

    for (const phase of EDGE_MODE_PHASES) {
      const playSegments = segments.filter(
        segment => segment.factor === phase.factor && segment.startMs >= cursorOriginalMs,
      );
      const phaseEndOriginalMs = playSegments[playSegments.length - 1]!.endMs;
      elapsedWallMs += phase.durationMs;

      // A zero-width pause span maps to its far side, so this lands after any
      // trailing pause — i.e. on the phase boundary itself
      expect(warp.originalToWarped(phaseEndOriginalMs)).toBeCloseTo(elapsedWallMs, 6);

      cursorOriginalMs = phaseEndOriginalMs;
    }
  });

  it('uses the stated factors in order', () => {
    const factors = compileEdgeMode(0, SCRIPT_DURATION_MS)
      .filter(segment => segment.factor !== 0)
      .map(segment => segment.factor);

    expect([...new Set(factors)]).toEqual([0.25, 0.5, 0.75]);
  });

  it('pauses for the phase pause length', () => {
    const segments = compileEdgeMode(0, SCRIPT_DURATION_MS);
    const pauseLengths = segments
      .filter(segment => segment.factor === 0)
      .map(segment => segment.pauseDurationMs);

    expect([...new Set(pauseLengths)]).toEqual([5_000, 2_000, 1_000]);
  });

  it('starts at the playhead and leaves earlier script time untouched', () => {
    const segments = compileEdgeMode(90_000, SCRIPT_DURATION_MS);

    expect(segments[0]!.startMs).toBe(90_000);
    expect(warpOf(segments).originalToWarped(45_000)).toBeCloseTo(45_000, 6);
  });

  it('returns to original speed once the program is over', () => {
    const segments = compileEdgeMode(0, SCRIPT_DURATION_MS);
    const warp = warpOf(segments);
    const endOriginalMs = edgeModeEndOriginalMs(segments, 0);

    const afterStart = warp.originalToWarped(endOriginalMs + 10_000);
    const afterEnd = warp.originalToWarped(endOriginalMs + 20_000);

    expect(afterEnd - afterStart).toBeCloseTo(10_000, 6);
  });

  it('truncates rather than overrunning a short script', () => {
    const shortDurationMs = 20_000;
    const segments = compileEdgeMode(0, shortDurationMs);

    for (const segment of segments) {
      expect(segment.endMs).toBeLessThanOrEqual(shortDurationMs);
    }
    expect(edgeModeEndOriginalMs(segments, 0)).toBeLessThanOrEqual(shortDurationMs);
  });

  it('compiles nothing for an empty script', () => {
    expect(compileEdgeMode(0, 0)).toEqual([]);
  });

  it('warps actions to strictly increasing integer timestamps', () => {
    const actions: FunscriptAction[] = Array.from({ length: 600 }, (_, i) => ({
      at: i * 500,
      pos: i % 2 === 0 ? 0 : 100,
    }));

    const warped = applyWarp(actions, warpOf(compileEdgeMode(0, SCRIPT_DURATION_MS)));

    expect(warped.length).toBeGreaterThan(0);
    for (let i = 0; i < warped.length; i++) {
      expect(Number.isInteger(warped[i]!.at)).toBe(true);
      if (i > 0) expect(warped[i]!.at).toBeGreaterThan(warped[i - 1]!.at);
    }
  });

  it('honours a custom phase list', () => {
    const phases: EdgePhase[] = [{ factor: 0.5, playMs: 1_000, pauseMs: 1_000, durationMs: 4_000 }];
    const segments = compileEdgeMode(0, SCRIPT_DURATION_MS, phases);

    expect(segments.filter(segment => segment.factor === 0.5)).toHaveLength(2);
    expect(segments.filter(segment => segment.factor === 0)).toHaveLength(2);
    expect(warpOf(segments).originalToWarped(edgeModeEndOriginalMs(segments, 0))).toBeCloseTo(4_000, 6);
  });
});
