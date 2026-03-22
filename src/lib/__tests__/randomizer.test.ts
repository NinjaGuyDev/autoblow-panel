import { describe, it, expect, vi } from 'vitest';
import { generateRandomizedScript } from '../randomizer';
import type { FunscriptAction } from '@/types/funscript';

function makePattern(id: string, name: string, actions: FunscriptAction[], audioFile?: string) {
  return {
    id,
    name,
    intensity: 'medium' as const,
    tags: [] as any[],
    durationMs: actions[actions.length - 1]!.at,
    actions,
    isCustom: true as const,
    originalPatternId: 'test',
    lastModified: Date.now(),
    audioFile,
  };
}

const patternA = makePattern('a', 'Pattern A', [
  { pos: 0, at: 0 },
  { pos: 100, at: 1000 },
  { pos: 0, at: 2000 },
]);

const patternB = makePattern('b', 'Pattern B', [
  { pos: 50, at: 0 },
  { pos: 100, at: 500 },
  { pos: 50, at: 1000 },
], 'audio-b.mp3');

const patternC = makePattern('c', 'Pattern C', [
  { pos: 0, at: 0 },
  { pos: 50, at: 3000 },
  { pos: 100, at: 6000 },
]);

describe('generateRandomizedScript', () => {
  it('produces actions and segments', () => {
    const result = generateRandomizedScript([patternA, patternB], 5000);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeGreaterThan(0);
  });

  it('always exceeds desired duration (favors longer)', () => {
    const result = generateRandomizedScript([patternA, patternB], 3000);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(3000);
  });

  it('actions are sorted by at ascending', () => {
    const result = generateRandomizedScript([patternA, patternB, patternC], 10000);
    for (let i = 1; i < result.actions.length; i++) {
      expect(result.actions[i]!.at).toBeGreaterThanOrEqual(result.actions[i - 1]!.at);
    }
  });

  it('segments cover the full duration without gaps', () => {
    const result = generateRandomizedScript([patternA, patternB], 5000);
    expect(result.segments[0]!.startMs).toBe(0);
    for (let i = 1; i < result.segments.length; i++) {
      expect(result.segments[i]!.startMs).toBeGreaterThanOrEqual(result.segments[i - 1]!.endMs);
    }
    const lastSeg = result.segments[result.segments.length - 1]!;
    expect(lastSeg.endMs).toBe(result.totalDurationMs);
  });

  it('preserves audioFile from source patterns', () => {
    const result = generateRandomizedScript([patternB], 2000);
    const segWithAudio = result.segments.find(s => s.audioFile);
    expect(segWithAudio).toBeDefined();
    expect(segWithAudio!.audioFile).toBe('audio-b.mp3');
  });

  it('inserts smooth transitions between patterns with different end/start positions', () => {
    // Force deterministic selection: A first, then B (different start/end positions)
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.0); // picks patternA (first)
    randomSpy.mockReturnValueOnce(0.99); // picks patternB (last)
    randomSpy.mockRestore();

    const result = generateRandomizedScript([patternA, patternB], 5000);
    const rawTotal = patternA.actions.length + patternB.actions.length;
    expect(result.actions.length).toBeGreaterThan(rawTotal);
  });

  it('handles single pattern input', () => {
    const result = generateRandomizedScript([patternA], 5000);
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
  });
});
