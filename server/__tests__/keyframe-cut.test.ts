import { describe, it, expect } from 'vitest';
import { latestDistinctKeyframeAtOrBefore, measureCutOffset, type KeyframePacket } from '../lib/keyframe-cut.js';

const keyframe = (ptsSeconds: number, dataHash = `hash-${ptsSeconds}`): KeyframePacket => ({ ptsSeconds, dataHash });

describe('latestDistinctKeyframeAtOrBefore', () => {
  it('picks the last keyframe at or before the target', () => {
    expect(latestDistinctKeyframeAtOrBefore([keyframe(0), keyframe(2), keyframe(4)], 3.9)).toEqual(keyframe(2));
  });

  it('accepts a keyframe printed a hair past the target', () => {
    expect(latestDistinctKeyframeAtOrBefore([keyframe(4.000001)], 4)).toEqual(keyframe(4.000001));
  });

  it('ignores input order', () => {
    expect(latestDistinctKeyframeAtOrBefore([keyframe(4), keyframe(0), keyframe(2)], 5)).toEqual(keyframe(4));
  });

  it('returns null when every keyframe is after the target', () => {
    expect(latestDistinctKeyframeAtOrBefore([keyframe(6)], 5)).toBeNull();
  });

  it('steps back past keyframes that repeat byte for byte', () => {
    const titleCard = [keyframe(0), keyframe(2), keyframe(4, 'card'), keyframe(6, 'card'), keyframe(8, 'card')];
    expect(latestDistinctKeyframeAtOrBefore(titleCard, 8)).toEqual(keyframe(2));
  });

  it('counts repeats after the target too', () => {
    // The 4 s keyframe recurs at 10 s, so a cut there could not be measured
    expect(latestDistinctKeyframeAtOrBefore([keyframe(2), keyframe(4, 'card'), keyframe(10, 'card')], 5)).toEqual(keyframe(2));
  });
});

describe('measureCutOffset', () => {
  const source = [keyframe(6.023, 'six'), keyframe(8.023, 'eight')];

  it('measures from the keyframe the output really starts on', () => {
    // The demuxer was asked for 8.023 but landed on 6.023
    const measurement = measureCutOffset(source, keyframe(0.083, 'six'), 8.023);
    expect(measurement.status).toBe('matched');
    expect(measurement.status === 'matched' && measurement.offsetSeconds).toBeCloseTo(5.94, 6);
  });

  it('ignores keyframes after the requested start', () => {
    expect(measureCutOffset([keyframe(2, 'x'), keyframe(9, 'x')], keyframe(0, 'x'), 2)).toEqual({ status: 'matched', offsetSeconds: 2 });
  });

  it('reports identical candidate keyframes as ambiguous', () => {
    const blackIntro = [keyframe(0, 'black'), keyframe(2, 'black'), keyframe(4, 'black')];
    expect(measureCutOffset(blackIntro, keyframe(0, 'black'), 4)).toEqual({ status: 'ambiguous' });
  });

  it('reports an output keyframe missing from the source list as unmatched', () => {
    expect(measureCutOffset(source, keyframe(0, 'unknown'), 8.023)).toEqual({ status: 'unmatched' });
  });
});
