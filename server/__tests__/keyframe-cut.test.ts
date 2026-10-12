import { describe, it, expect } from 'vitest';
import { latestKeyframeAtOrBefore, measureCutOffsetSeconds, type KeyframePacket } from '../lib/keyframe-cut.js';

const keyframe = (ptsSeconds: number, dataHash = `hash-${ptsSeconds}`): KeyframePacket => ({ ptsSeconds, dataHash });

describe('latestKeyframeAtOrBefore', () => {
  it('picks the last keyframe at or before the target', () => {
    expect(latestKeyframeAtOrBefore([keyframe(0), keyframe(2), keyframe(4)], 3.9)).toEqual(keyframe(2));
  });

  it('accepts a keyframe printed a hair past the target', () => {
    expect(latestKeyframeAtOrBefore([keyframe(4.000001)], 4)).toEqual(keyframe(4.000001));
  });

  it('ignores input order', () => {
    expect(latestKeyframeAtOrBefore([keyframe(4), keyframe(0), keyframe(2)], 5)).toEqual(keyframe(4));
  });

  it('returns null when every keyframe is after the target', () => {
    expect(latestKeyframeAtOrBefore([keyframe(6)], 5)).toBeNull();
  });
});

describe('measureCutOffsetSeconds', () => {
  const source = [keyframe(6.023, 'six'), keyframe(8.023, 'eight')];

  it('measures from the keyframe the output really starts on', () => {
    // The demuxer was asked for 8.023 but landed on 6.023
    expect(measureCutOffsetSeconds(source, keyframe(0.083, 'six'), 8.023)).toBeCloseTo(5.94, 6);
  });

  it('takes the latest identical keyframe at or before the requested start', () => {
    const blackIntro = [keyframe(0, 'black'), keyframe(2, 'black'), keyframe(4, 'black')];
    expect(measureCutOffsetSeconds(blackIntro, keyframe(0, 'black'), 2)).toBe(2);
  });

  it('returns null when the output keyframe is not in the source list', () => {
    expect(measureCutOffsetSeconds(source, keyframe(0, 'unknown'), 8.023)).toBeNull();
  });
});
