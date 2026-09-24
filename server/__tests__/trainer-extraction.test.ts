import { describe, it, expect } from 'vitest';
import type { FunscriptActionDto } from '../types/shared.js';
import {
  longestStillRunMs,
  maxSegmentSpeed,
  normalizeActions,
  reversalIndices,
  segmentSpeed,
  tileSampleWindows,
  type WindowRules,
} from '../lib/trainer/sample-windows.js';
import { describeActions, turningPoints } from '../lib/trainer/pattern-features.js';
import { clusterByAverageLinkage, pickVariations } from '../lib/trainer/clustering.js';
import { familyLetter } from '../lib/trainer/pattern-naming.js';
import { DEFAULT_EXTRACTION_OPTIONS, extractTrainerPatterns } from '../lib/trainer/extract-trainer-patterns.js';

const RULES: WindowRules = {
  targetDurationMs: 10_000,
  minDurationMs: 8_000,
  maxDurationMs: 12_000,
  maxSpeed: 130,
  maxStillMs: 3_000,
  stillSpeed: 5,
  minReversals: 3,
};

/** Full 0-100 strokes, one half-stroke every `halfStrokeMs`. */
function strokes(count: number, halfStrokeMs: number, startAt = 0): FunscriptActionDto[] {
  return Array.from({ length: count + 1 }, (_, i) => ({ at: startAt + i * halfStrokeMs, pos: i % 2 === 0 ? 0 : 100 }));
}

describe('sample windows', () => {
  it('measures speed in position units per second', () => {
    expect(segmentSpeed({ at: 0, pos: 0 }, { at: 1_000, pos: 100 })).toBe(100);
    expect(segmentSpeed({ at: 5, pos: 0 }, { at: 5, pos: 100 })).toBe(0);
  });

  it('sorts, de-duplicates timestamps and clamps positions', () => {
    expect(normalizeActions([{ at: 20, pos: 150 }, { at: 10, pos: 5 }, { at: 10, pos: 7 }]))
      .toEqual([{ at: 10, pos: 7 }, { at: 20, pos: 100 }]);
  });

  it('finds reversals across flat holds', () => {
    const actions = [{ at: 0, pos: 0 }, { at: 1, pos: 50 }, { at: 2, pos: 50 }, { at: 3, pos: 10 }, { at: 4, pos: 90 }];
    expect(reversalIndices(actions)).toEqual([1, 3]);
  });

  it('counts a hold that spans the loop seam', () => {
    const actions = [{ at: 0, pos: 50 }, { at: 2_000, pos: 50 }, { at: 3_000, pos: 100 }, { at: 5_000, pos: 100 }];
    expect(longestStillRunMs(actions, 5)).toBe(4_000);
  });

  it('cuts back-to-back windows without changing timing', () => {
    const windows = tileSampleWindows('src', strokes(40, 1_000), RULES);

    expect(windows.length).toBe(4);
    for (const window of windows) {
      expect(window.actions[0]!.at).toBe(0);
      expect(window.actions[window.actions.length - 1]!.at).toBe(10_000);
      expect(maxSegmentSpeed(window.actions)).toBe(100);
    }
    expect(windows.map(w => w.startMs)).toEqual([0, 10_000, 20_000, 30_000]);
  });

  it('skips stretches faster than the speed cap', () => {
    const fast = strokes(30, 500); // 200 units per second
    expect(tileSampleWindows('src', fast, RULES)).toEqual([]);
  });

  it('skips stretches that hold still for longer than allowed', () => {
    const withLongHold = [...strokes(4, 1_000), { at: 8_000, pos: 0 }, ...strokes(10, 1_000, 9_000).slice(1)];
    const windows = tileSampleWindows('src', withLongHold, RULES);
    for (const window of windows) {
      expect(longestStillRunMs(window.actions, RULES.stillSpeed)).toBeLessThanOrEqual(RULES.maxStillMs);
    }
  });
});

describe('pattern features', () => {
  it('ignores wiggles smaller than the turn amplitude', () => {
    const actions = [{ at: 0, pos: 0 }, { at: 100, pos: 60 }, { at: 200, pos: 55 }, { at: 300, pos: 100 }, { at: 400, pos: 0 }];
    expect(turningPoints(actions, 10).map(p => p.pos)).toEqual([0, 100, 0]);
  });

  it('describes a regular full stroke', () => {
    const features = describeActions(strokes(10, 1_000), { stillSpeed: 5, turnAmplitude: 10 });
    expect(features.halfStrokesPerSecond).toBe(1);
    expect(features.meanAmplitude).toBe(100);
    expect(features.meanPosition).toBe(50);
    expect(features.averageSpeed).toBe(100);
    expect(features.stillFraction).toBe(0);
    expect(features.tempoVariation).toBe(0);
  });
});

describe('clustering', () => {
  const distance = (a: number, b: number) => Math.abs(a - b);

  it('groups nearby values and keeps distant ones apart', () => {
    const clusters = clusterByAverageLinkage([1, 1.2, 10, 10.5, 30], distance, 1);
    expect(clusters.map(c => [...c].sort((a, b) => a - b))).toEqual([[1, 1.2], [10, 10.5], [30]]);
  });

  it('picks the medoid then spread-out variations', () => {
    expect(pickVariations([0, 0.1, 1, 2, 2.05], distance, 0.5, 3)).toEqual([1, 2.05, 0]);
  });

  it('never picks the same member twice', () => {
    expect(pickVariations([5, 5, 5], distance, 0, 3)).toEqual([5]);
  });
});

describe('extractTrainerPatterns', () => {
  it('names families by letter and numbers their variations', () => {
    expect([0, 25, 26, 27].map(familyLetter)).toEqual(['A', 'Z', 'AA', 'AB']);

    const patterns = extractTrainerPatterns([{ label: 'src', actions: strokes(60, 1_000) }], DEFAULT_EXTRACTION_OPTIONS);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]!.familyKey).toBe('A');
    expect(patterns[0]!.variation).toBe(1);
    expect(patterns[0]!.patternKey).toBe(`src@${0}`);
  });
});
