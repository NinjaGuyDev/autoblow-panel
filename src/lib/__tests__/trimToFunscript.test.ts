import { describe, it, expect } from 'vitest';
import { trimTargetForActions } from '../trimToFunscript';
import { TRIM_LEAD_IN_MS, TRIM_MIN_CUT_MS } from '@server/types/shared';

describe('trimTargetForActions', () => {
  it('aims a lead-in before the first action', () => {
    expect(trimTargetForActions([{ at: 30_000, pos: 0 }, { at: 31_000, pos: 90 }])).toBe(30_000 - TRIM_LEAD_IN_MS);
  });

  it('uses the earliest action of an unsorted script', () => {
    expect(trimTargetForActions([{ at: 60_000, pos: 0 }, { at: 20_000, pos: 90 }])).toBe(20_000 - TRIM_LEAD_IN_MS);
  });

  it('offers nothing when the cut would be shorter than the minimum', () => {
    expect(trimTargetForActions([{ at: TRIM_LEAD_IN_MS + TRIM_MIN_CUT_MS - 1, pos: 0 }])).toBeNull();
  });

  it('offers the shortest cut that clears the minimum', () => {
    expect(trimTargetForActions([{ at: TRIM_LEAD_IN_MS + TRIM_MIN_CUT_MS, pos: 0 }])).toBe(TRIM_MIN_CUT_MS);
  });

  it('offers nothing for an empty script', () => {
    expect(trimTargetForActions([])).toBeNull();
  });
});
