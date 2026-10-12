import { describe, it, expect } from 'vitest';
import { earliestActionMs, shiftFunscriptStart } from '../lib/funscript-shift.js';

describe('shiftFunscriptStart', () => {
  const script = {
    version: '1.0',
    OpenFunscripter: { Bookmarks: [] },
    metadata: { duration: 845, title: 'clip' },
    actions: [{ at: 30_033, pos: 90 }, { at: 31_000, pos: 0 }],
  };

  it('moves every action earlier by the cut', () => {
    expect(shiftFunscriptStart(script, 15_201).actions).toEqual([{ at: 14_832, pos: 90 }, { at: 15_799, pos: 0 }]);
  });

  it('shortens metadata.duration and keeps every other field', () => {
    const shifted = shiftFunscriptStart(script, 30_000);
    expect(shifted.metadata).toEqual({ duration: 815, title: 'clip' });
    expect(shifted.version).toBe('1.0');
    expect(shifted.OpenFunscripter).toEqual({ Bookmarks: [] });
  });

  it('leaves a script without metadata.duration without one', () => {
    expect(shiftFunscriptStart({ actions: [{ at: 5_000, pos: 0 }] }, 1_000)).toEqual({ actions: [{ at: 4_000, pos: 0 }] });
  });

  it('does not modify its input', () => {
    shiftFunscriptStart(script, 10_000);
    expect(script.actions[0]!.at).toBe(30_033);
  });

  it('refuses a cut past the first action', () => {
    expect(() => shiftFunscriptStart(script, 30_034)).toThrow(RangeError);
  });

  it('refuses a negative cut', () => {
    expect(() => shiftFunscriptStart(script, -1)).toThrow(RangeError);
  });
});

describe('earliestActionMs', () => {
  it('finds the earliest action in an unsorted script', () => {
    expect(earliestActionMs({ actions: [{ at: 900, pos: 0 }, { at: 300, pos: 50 }] })).toBe(300);
  });
});
