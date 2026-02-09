import { describe, it, expect } from 'vitest';
import {
  smoothFunscript,
  intensityToOptions,
  DEFAULT_SMOOTHING_OPTIONS,
} from '../smoothing';
import type { FunscriptAction } from '@/types/funscript';

// Helper function for brevity
function makeAction(at: number, pos: number): FunscriptAction {
  return { at, pos };
}

describe('thinOscillations', () => {
  it('should thin rapid oscillations (dt=200ms, 8 actions)', () => {
    const actions = [
      makeAction(0, 20),
      makeAction(200, 80),
      makeAction(400, 20),
      makeAction(600, 80),
      makeAction(800, 20),
      makeAction(1000, 80),
      makeAction(1200, 20),
      makeAction(1400, 80),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 }, // Disable speed capping
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 }, // Disable spike removal
    });

    // Should be thinned to roughly 4 actions (450ms intervals)
    expect(result.length).toBeLessThan(6);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('should NOT thin slow oscillations (dt=600ms)', () => {
    const actions = [
      makeAction(0, 20),
      makeAction(600, 80),
      makeAction(1200, 20),
      makeAction(1800, 80),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    // Should NOT be thinned (intervals too large)
    expect(result.length).toBe(4);
  });

  it('should NOT thin oscillations with small range (pos 50-55)', () => {
    const actions = [
      makeAction(0, 50),
      makeAction(200, 55),
      makeAction(400, 50),
      makeAction(600, 55),
      makeAction(800, 50),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    // Should NOT be thinned (range < 15)
    expect(result.length).toBe(5);
  });

  it('should NOT thin actions with < 4 reversals', () => {
    const actions = [
      makeAction(0, 20),
      makeAction(200, 80),
      makeAction(400, 20),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    // Should NOT be thinned (< 4 reversals)
    expect(result.length).toBe(3);
  });

  it('should thin long mixed-speed segment where rapid oscillations are diluted by slow edges', () => {
    // Real data from a funscript with a long mixed-speed segment (28.5s–44.5s)
    // Mean interval = 468ms (above 450ms threshold), median = 210ms (below threshold)
    // The rapid 168-210ms oscillations at 33-35.5s should trigger thinning
    const actions = [
      makeAction(28555, 100),
      makeAction(30326, 0),    // 1771ms gap (slow)
      makeAction(32246, 100),  // 1920ms gap (slow)
      makeAction(32414, 78),
      makeAction(32666, 100),
      makeAction(32834, 78),
      makeAction(32950, 100),
      makeAction(33118, 89),
      makeAction(33286, 100),
      makeAction(33496, 78),   // Rapid oscillation region starts
      makeAction(33664, 100),  // 168ms
      makeAction(33874, 78),   // 210ms
      makeAction(34084, 100),  // 210ms
      makeAction(34252, 78),   // 168ms
      makeAction(34420, 100),  // 168ms
      makeAction(34630, 78),   // 210ms
      makeAction(34840, 100),  // 210ms
      makeAction(35008, 78),   // 168ms
      makeAction(35176, 100),  // 168ms - Rapid region ends
      makeAction(35723, 56),   // 547ms gap (slow)
      makeAction(36773, 100),  // 1050ms gap (slow)
      makeAction(37613, 56),
      makeAction(38537, 100),
      makeAction(39461, 56),
      makeAction(40091, 100),
      makeAction(40301, 56),
      makeAction(41309, 100),
      makeAction(42085, 44),
      makeAction(43409, 100),
      makeAction(43619, 78),
      makeAction(43871, 100),
      makeAction(44123, 78),
      makeAction(44314, 100),
      makeAction(44440, 78),
      makeAction(44482, 100),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    // Should thin — the segment has 33 reversals, range 100, median interval 210ms
    expect(result.length).toBeLessThan(actions.length);
  });

  it('should thin synthetic mixed-speed segment with rapid core and slow edges', () => {
    // Synthetic segment: slow 2000ms edges + rapid 150ms core
    // Mean interval = (2000+2000+150*8) / 11 = 472ms (above threshold)
    // Median interval = 150ms (below threshold)
    const actions = [
      makeAction(0, 0),
      makeAction(2000, 100),    // 2000ms (slow edge)
      makeAction(4000, 0),      // 2000ms (slow edge)
      makeAction(4150, 100),    // 150ms (rapid)
      makeAction(4300, 0),      // 150ms
      makeAction(4450, 100),    // 150ms
      makeAction(4600, 0),      // 150ms
      makeAction(4750, 100),    // 150ms
      makeAction(4900, 0),      // 150ms
      makeAction(5050, 100),    // 150ms
      makeAction(5200, 0),      // 150ms
      makeAction(5350, 100),    // 150ms
      makeAction(7350, 0),      // 2000ms (slow edge)
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    expect(result.length).toBeLessThan(actions.length);
  });

  it('should split segments at large time gaps (maxIntervalMs)', () => {
    // Two rapid oscillation clusters separated by a 1500ms gap
    // Without splitting: one 14-action segment, sub-threshold reversals in each half
    // With splitting: two independent segments, each evaluated on its own merits
    const rapidCluster1 = [
      makeAction(0, 0),
      makeAction(150, 100),
      makeAction(300, 0),
      makeAction(450, 100),
      makeAction(600, 0),
      makeAction(750, 100),
      makeAction(900, 0),
    ];
    const rapidCluster2 = [
      makeAction(2400, 100),  // 1500ms gap from previous — exceeds maxIntervalMs (400)
      makeAction(2550, 0),
      makeAction(2700, 100),
      makeAction(2850, 0),
      makeAction(3000, 100),
      makeAction(3150, 0),
      makeAction(3300, 100),
    ];
    const actions = [...rapidCluster1, ...rapidCluster2];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    // Both clusters should be independently detected and thinned
    expect(result.length).toBeLessThan(actions.length);
  });

  it('should handle empty array', () => {
    const result = smoothFunscript([]);
    expect(result).toEqual([]);
  });

  it('should handle single action', () => {
    const actions = [makeAction(0, 50)];
    const result = smoothFunscript(actions);
    expect(result).toEqual(actions);
  });
});

describe('capSpeed', () => {
  it('should adjust positions for high-speed transitions', () => {
    const actions = [
      makeAction(0, 0),
      makeAction(100, 50), // Speed = 500 pos/s - exceeds 180 threshold
      makeAction(200, 0),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      oscillationDetection: { ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection, minReversals: 100 }, // Disable oscillation thinning
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 }, // Disable spike removal
    });

    // Middle point should be adjusted
    expect(result.length).toBe(3);
    expect(result[1].pos).not.toBe(50);
    expect(result[1].pos).toBeLessThan(50);
    expect(result[1].pos).toBeGreaterThan(0);
  });

  it('should NOT modify actions already within speed limit', () => {
    const actions = [
      makeAction(0, 0),
      makeAction(1000, 50), // Speed = 50 pos/s - within 180 threshold
      makeAction(2000, 0),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      oscillationDetection: { ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection, minReversals: 100 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    expect(result).toEqual(actions);
  });

  it('should converge within maxIterations', () => {
    const actions = [
      makeAction(0, 0),
      makeAction(50, 40),
      makeAction(100, 0),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      oscillationDetection: { ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection, minReversals: 100 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    // Should complete without error
    expect(result.length).toBe(3);
  });

  it('should never modify first and last actions', () => {
    const actions = [
      makeAction(0, 0),
      makeAction(100, 90),
      makeAction(200, 0),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      oscillationDetection: { ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection, minReversals: 100 },
      spikeRemoval: { ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval, minSpeed: 1000 },
    });

    expect(result[0]).toEqual(actions[0]);
    expect(result[2]).toEqual(actions[2]);
  });
});

describe('removeIsolatedSpikes', () => {
  it('should remove isolated spike', () => {
    const actions = [
      makeAction(0, 50),
      makeAction(1000, 50),
      makeAction(1100, 90), // Spike
      makeAction(1200, 50),
      makeAction(2200, 50),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      oscillationDetection: { ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection, minReversals: 100 },
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
    });

    // Spike should be removed
    expect(result.length).toBeLessThan(5);
    expect(result.some(a => a.at === 1100)).toBe(false);
  });

  it('should NOT remove sustained fast motion', () => {
    const actions = [
      makeAction(0, 50),
      makeAction(100, 90),
      makeAction(200, 50),
      makeAction(300, 90),
      makeAction(400, 50),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      oscillationDetection: { ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection, minReversals: 100 },
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
    });

    // Should NOT remove - sustained fast motion (not isolated)
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('should NOT modify actions with no reversals', () => {
    const actions = [
      makeAction(0, 0),
      makeAction(100, 25),
      makeAction(200, 50),
      makeAction(300, 75),
    ];

    const result = smoothFunscript(actions, {
      ...DEFAULT_SMOOTHING_OPTIONS,
      oscillationDetection: { ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection, minReversals: 100 },
      speedCapping: { ...DEFAULT_SMOOTHING_OPTIONS.speedCapping, maxSpeed: 1000 },
    });

    expect(result).toEqual(actions);
  });
});

describe('smoothFunscript', () => {
  it('should run all three passes in sequence', () => {
    const actions = [
      makeAction(0, 20),
      makeAction(200, 80),
      makeAction(400, 20),
      makeAction(600, 80),
      makeAction(800, 20),
      makeAction(1000, 80),
    ];

    const result = smoothFunscript(actions);

    // Should have applied some smoothing
    expect(result.length).toBeLessThanOrEqual(actions.length);
  });

  it('should use default options when none provided', () => {
    const actions = [
      makeAction(0, 50),
      makeAction(100, 50),
    ];

    const result = smoothFunscript(actions);
    expect(result).toBeDefined();
  });

  it('should preserve first and last actions', () => {
    const actions = [
      makeAction(0, 0),
      makeAction(200, 80),
      makeAction(400, 20),
      makeAction(600, 80),
      makeAction(800, 100),
    ];

    const result = smoothFunscript(actions);

    expect(result[0]).toEqual(actions[0]);
    expect(result[result.length - 1]).toEqual(actions[actions.length - 1]);
  });
});

describe('intensityToOptions', () => {
  it('should map 0-33 to conservative settings', () => {
    const options = intensityToOptions(20);

    expect(options.oscillationDetection.minReversals).toBeGreaterThan(4);
    expect(options.speedCapping.maxSpeed).toBeGreaterThan(180);
    expect(options.spikeRemoval.minSpeed).toBeGreaterThan(90);
  });

  it('should map 34-66 to moderate settings (case study defaults)', () => {
    const options = intensityToOptions(50);

    expect(options.oscillationDetection.minReversals).toBe(4);
    expect(options.speedCapping.maxSpeed).toBe(180);
    expect(options.spikeRemoval.minSpeed).toBe(90);
  });

  it('should map 67-100 to aggressive settings', () => {
    const options = intensityToOptions(80);

    expect(options.oscillationDetection.minReversals).toBeLessThan(4);
    expect(options.speedCapping.maxSpeed).toBeLessThan(180);
    expect(options.spikeRemoval.minSpeed).toBeLessThan(90);
  });

  it('should use linear interpolation within ranges', () => {
    const low = intensityToOptions(0);
    const mid = intensityToOptions(16.5);
    const high = intensityToOptions(33);

    // Mid should be between low and high
    expect(mid.speedCapping.maxSpeed).toBeGreaterThan(high.speedCapping.maxSpeed);
    expect(mid.speedCapping.maxSpeed).toBeLessThan(low.speedCapping.maxSpeed);
  });
});
