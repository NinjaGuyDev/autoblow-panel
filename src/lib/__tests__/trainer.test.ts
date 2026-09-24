import { describe, it, expect } from 'vitest';
import { pickNextPattern, selectionWeight } from '@/lib/trainer/patternSelection';
import { buildTrainerLoop, joinDurationMs, loopEndPosition, JOIN_SPEED } from '@/lib/trainer/trainerLoop';
import { rankFromKeyCode } from '@/lib/trainer/rankKeys';
import { formatRankSummary } from '@/lib/trainer/trainerPatternCard';
import { TRAINER_MAX_SPEED } from '@server/types/shared';

describe('pickNextPattern', () => {
  const patterns = [
    { id: 1, rankCount: 0 },
    { id: 2, rankCount: 0 },
    { id: 3, rankCount: 3 },
  ];

  it('never repeats the pattern that just played', () => {
    for (let r = 0; r < 1; r += 0.01) {
      expect(pickNextPattern(patterns, 2, () => r)?.id).not.toBe(2);
    }
  });

  it('replays the only pattern when there is nothing else', () => {
    expect(pickNextPattern([{ id: 7, rankCount: 4 }], 7)?.id).toBe(7);
    expect(pickNextPattern([], null)).toBeNull();
  });

  it('favors patterns ranked fewer times', () => {
    // Weights 1, 1, 1/16 — the heavily ranked pattern owns only the last sliver
    const total = 2 + selectionWeight(3);
    expect(pickNextPattern(patterns, null, () => 1.99 / total)?.id).toBe(2);
    expect(pickNextPattern(patterns, null, () => 2.01 / total)?.id).toBe(3);
    expect(selectionWeight(0)).toBeGreaterThan(selectionWeight(1));
  });
});

describe('buildTrainerLoop', () => {
  const pattern = [{ at: 0, pos: 20 }, { at: 1_000, pos: 80 }, { at: 2_000, pos: 60 }];

  it('adds only a seam back to the start when there is no lead-in', () => {
    const loop = buildTrainerLoop(pattern, null);
    expect(loop.leadInMs).toBe(0);
    expect(loop.actions.slice(0, 3)).toEqual(pattern);
    expect(loop.actions[3]).toEqual({ at: 2_000 + joinDurationMs(60, 20), pos: 20 });
    expect(loopEndPosition(loop)).toBe(20);
  });

  it('leads in from the previous position without changing the pattern timing', () => {
    const loop = buildTrainerLoop(pattern, 70);
    expect(loop.leadInMs).toBe(joinDurationMs(70, 20));
    expect(loop.actions[0]).toEqual({ at: 0, pos: 70 });
    expect(loop.actions.slice(1, 4)).toEqual(pattern.map(a => ({ ...a, at: a.at + loop.leadInMs })));
  });

  it('keeps the joins under the trainer speed cap', () => {
    expect(JOIN_SPEED).toBeLessThanOrEqual(TRAINER_MAX_SPEED);
    expect((100 / joinDurationMs(0, 100)) * 1000).toBeLessThanOrEqual(TRAINER_MAX_SPEED);
  });
});

describe('rankFromKeyCode', () => {
  it('reads the top row and numpad digits', () => {
    expect(rankFromKeyCode('Digit0')).toBe(0);
    expect(rankFromKeyCode('Digit9')).toBe(9);
    expect(rankFromKeyCode('Numpad7')).toBe(7);
  });

  it('ignores every other key', () => {
    expect(rankFromKeyCode('KeyA')).toBeNull();
    expect(rankFromKeyCode('NumpadAdd')).toBeNull();
    expect(rankFromKeyCode('F1')).toBeNull();
  });
});

describe('formatRankSummary', () => {
  it('shows the average and count, or Unranked', () => {
    expect(formatRankSummary({ averageRank: null, rankCount: 0 })).toBe('Unranked');
    expect(formatRankSummary({ averageRank: 7.25, rankCount: 1 })).toBe('7.3 avg · 1 rank');
    expect(formatRankSummary({ averageRank: 5, rankCount: 4 })).toBe('5.0 avg · 4 ranks');
  });
});
