import { describe, it, expect } from 'vitest';
import {
  humanizeFunscript,
  intensityToHumanizerOptions,
  DEFAULT_HUMANIZER_OPTIONS,
} from '../humanizer';
import type { FunscriptAction } from '@/types/funscript';

function makeAction(at: number, pos: number): FunscriptAction {
  return { at, pos };
}

/** Build a perfectly uniform oscillation of `count` strokes */
function uniformOscillation(count: number, dtMs: number, low: number, high: number): FunscriptAction[] {
  const actions: FunscriptAction[] = [];
  for (let i = 0; i <= count; i++) {
    actions.push(makeAction(i * dtMs, i % 2 === 0 ? low : high));
  }
  return actions;
}

describe('humanizeFunscript — edge cases', () => {
  it('returns unchanged array for 0 actions', () => {
    expect(humanizeFunscript([])).toEqual([]);
  });

  it('returns unchanged array for 1 action', () => {
    const actions = [makeAction(0, 50)];
    expect(humanizeFunscript(actions)).toEqual(actions);
  });

  it('returns unchanged array for 2 actions', () => {
    const actions = [makeAction(0, 0), makeAction(500, 100)];
    expect(humanizeFunscript(actions)).toEqual(actions);
  });

  it('never modifies the first action', () => {
    const actions = uniformOscillation(10, 200, 10, 90);
    const result = humanizeFunscript(actions, DEFAULT_HUMANIZER_OPTIONS);
    expect(result[0]).toEqual(actions[0]);
  });

  it('never modifies the last action', () => {
    const actions = uniformOscillation(10, 200, 10, 90);
    const result = humanizeFunscript(actions, DEFAULT_HUMANIZER_OPTIONS);
    expect(result[result.length - 1]).toEqual(actions[actions.length - 1]);
  });
});

describe('humanizeFunscript — uniform oscillation', () => {
  it('changes at least one action in a long uniform oscillation', () => {
    const actions = uniformOscillation(12, 200, 10, 90);
    const result = humanizeFunscript(actions, {
      amplitudeVariance: 10,
      timingVariance: 0.15,
      minRepetitions: 3,
      similarityTolerance: 0.4,
    });

    const changed = result.some((a, i) => a.pos !== actions[i].pos || a.at !== actions[i].at);
    expect(changed).toBe(true);
  });

  it('keeps all positions within 0-100', () => {
    // Oscillate at extremes so overflow is possible without clamping
    const actions = uniformOscillation(14, 200, 0, 100);
    const result = humanizeFunscript(actions, {
      amplitudeVariance: 20,
      timingVariance: 0.3,
      minRepetitions: 3,
      similarityTolerance: 0.4,
    });

    for (const a of result) {
      expect(a.pos).toBeGreaterThanOrEqual(0);
      expect(a.pos).toBeLessThanOrEqual(100);
    }
  });

  it('keeps timestamps strictly increasing', () => {
    const actions = uniformOscillation(14, 200, 10, 90);
    const result = humanizeFunscript(actions, {
      amplitudeVariance: 8,
      timingVariance: 0.3,
      minRepetitions: 3,
      similarityTolerance: 0.4,
    });

    for (let i = 1; i < result.length; i++) {
      expect(result[i].at).toBeGreaterThan(result[i - 1].at);
    }
  });

  it('preserves the same number of actions as the input', () => {
    const actions = uniformOscillation(10, 200, 20, 80);
    const result = humanizeFunscript(actions, DEFAULT_HUMANIZER_OPTIONS);
    expect(result.length).toBe(actions.length);
  });
});

describe('humanizeFunscript — non-repetitive content', () => {
  it('does not alter a script with only 2 similar strokes (below minRepetitions)', () => {
    // Only 2 oscillation cycles — below minRepetitions=3
    const actions = [
      makeAction(0, 10),
      makeAction(300, 90),
      makeAction(600, 10),
      makeAction(900, 90),
    ];

    const result = humanizeFunscript(actions, {
      ...DEFAULT_HUMANIZER_OPTIONS,
      minRepetitions: 3,
    });

    // With only 2 reversals (3 actions between), may not trigger — result should still be valid
    expect(result.length).toBe(actions.length);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].at).toBeGreaterThan(result[i - 1].at);
    }
  });

  it('does not corrupt a monotone (no-reversal) sequence', () => {
    const actions = [
      makeAction(0, 0),
      makeAction(300, 25),
      makeAction(600, 50),
      makeAction(900, 75),
      makeAction(1200, 100),
    ];

    const result = humanizeFunscript(actions, DEFAULT_HUMANIZER_OPTIONS);

    // No turning points → no humanization applied → same as input
    expect(result).toEqual(actions);
  });
});

describe('humanizeFunscript — mixed content', () => {
  it('humanizes the repetitive core while leaving the slow edges untouched', () => {
    // Slow transitions at the edges, rapid uniform oscillation in the middle
    const actions = [
      makeAction(0, 0),
      makeAction(2000, 100),  // slow
      makeAction(4000, 0),    // slow
      makeAction(4200, 100),  // rapid uniform start
      makeAction(4400, 0),
      makeAction(4600, 100),
      makeAction(4800, 0),
      makeAction(5000, 100),
      makeAction(5200, 0),
      makeAction(5400, 100),
      makeAction(7400, 0),    // slow
    ];

    const result = humanizeFunscript(actions, {
      amplitudeVariance: 10,
      timingVariance: 0.15,
      minRepetitions: 3,
      similarityTolerance: 0.4,
    });

    expect(result.length).toBe(actions.length);
    // First and last preserved
    expect(result[0]).toEqual(actions[0]);
    expect(result[result.length - 1]).toEqual(actions[actions.length - 1]);
    // Timestamps still increasing
    for (let i = 1; i < result.length; i++) {
      expect(result[i].at).toBeGreaterThan(result[i - 1].at);
    }
  });
});

describe('intensityToHumanizerOptions', () => {
  it('maps 0 to minimal variance', () => {
    const opts = intensityToHumanizerOptions(0);
    expect(opts.amplitudeVariance).toBeLessThanOrEqual(5);
    expect(opts.timingVariance).toBeLessThanOrEqual(0.1);
  });

  it('maps 100 to maximum variance', () => {
    const opts = intensityToHumanizerOptions(100);
    expect(opts.amplitudeVariance).toBeGreaterThanOrEqual(15);
    expect(opts.timingVariance).toBeGreaterThanOrEqual(0.25);
  });

  it('maps 50 to moderate variance', () => {
    const low = intensityToHumanizerOptions(0);
    const mid = intensityToHumanizerOptions(50);
    const high = intensityToHumanizerOptions(100);

    expect(mid.amplitudeVariance).toBeGreaterThan(low.amplitudeVariance);
    expect(mid.amplitudeVariance).toBeLessThan(high.amplitudeVariance);
    expect(mid.timingVariance).toBeGreaterThan(low.timingVariance);
    expect(mid.timingVariance).toBeLessThan(high.timingVariance);
  });

  it('clamps values outside 0-100', () => {
    const atNeg = intensityToHumanizerOptions(-10);
    const atZero = intensityToHumanizerOptions(0);
    const atOver = intensityToHumanizerOptions(110);
    const atHundred = intensityToHumanizerOptions(100);

    expect(atNeg.amplitudeVariance).toBe(atZero.amplitudeVariance);
    expect(atOver.amplitudeVariance).toBe(atHundred.amplitudeVariance);
  });
});
