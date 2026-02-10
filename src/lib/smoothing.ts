import type { FunscriptAction } from '@/types/funscript';
import { calculateSpeed } from '@/lib/funscriptValidator';

/**
 * Smoothing options for each pass
 */
export interface SmoothingOptions {
  oscillationDetection: {
    minReversals: number;        // Minimum consecutive reversals to trigger thinning
    maxIntervalMs: number;        // Maximum dt for individual transitions in oscillation
    minRange: number;             // Minimum position range to trigger thinning
    avgIntervalThreshold: number; // Average dt threshold for segment
    targetIntervalMs: number;     // Target interval after thinning
  };
  speedCapping: {
    maxSpeed: number;             // Maximum allowed speed (pos/s)
    interpolationWeight: number;  // Blend weight for position adjustment (0-1)
    maxIterations: number;        // Convergence iteration limit
  };
  spikeRemoval: {
    minSpeed: number;             // Minimum speed to consider as "fast" transition
    maxIntervalMs: number;        // Maximum dt for fast transition
  };
}

/**
 * Default smoothing options matching case study values
 */
export const DEFAULT_SMOOTHING_OPTIONS: SmoothingOptions = {
  oscillationDetection: {
    minReversals: 4,
    maxIntervalMs: 400,
    minRange: 15,
    avgIntervalThreshold: 450,
    targetIntervalMs: 450,
  },
  speedCapping: {
    maxSpeed: 180,
    interpolationWeight: 0.6,
    maxIterations: 5,
  },
  spikeRemoval: {
    minSpeed: 90,
    maxIntervalMs: 500,
  },
};

/**
 * Compute the median interval between consecutive actions
 */
function computeMedianInterval(actions: FunscriptAction[]): number {
  if (actions.length < 2) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < actions.length; i++) {
    intervals.push(actions[i].at - actions[i - 1].at);
  }
  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 0
    ? (intervals[mid - 1] + intervals[mid]) / 2
    : intervals[mid];
}

/**
 * Detect segments with consecutive direction reversals
 */
function detectOscillationSegments(
  actions: FunscriptAction[],
  minReversals: number,
  maxIntervalMs: number
): Array<{ startIndex: number; endIndex: number }> {
  if (actions.length < 3) return [];

  const segments: Array<{ startIndex: number; endIndex: number }> = [];
  let currentSegmentStart = -1;
  let reversalCount = 0;

  const finalizeSegment = (endIndex: number) => {
    if (reversalCount >= minReversals) {
      segments.push({ startIndex: currentSegmentStart, endIndex });
    }
    currentSegmentStart = -1;
    reversalCount = 0;
  };

  for (let i = 1; i < actions.length - 1; i++) {
    const dt = actions[i + 1].at - actions[i].at;
    const prevDelta = actions[i].pos - actions[i - 1].pos;
    const nextDelta = actions[i + 1].pos - actions[i].pos;

    // Direction reversal: signs differ (excluding zero)
    const isReversal = prevDelta * nextDelta < 0;

    // Split segment at large time gaps even if reversals continue
    if (currentSegmentStart !== -1 && dt > maxIntervalMs) {
      finalizeSegment(i);
      continue;
    }

    if (isReversal) {
      if (currentSegmentStart === -1) {
        currentSegmentStart = i - 1; // Include previous point
        reversalCount = 1;
      } else {
        reversalCount++;
      }
    } else {
      finalizeSegment(i);
    }
  }

  // Handle segment extending to end
  if (reversalCount >= minReversals && currentSegmentStart !== -1) {
    segments.push({
      startIndex: currentSegmentStart,
      endIndex: actions.length - 1,
    });
  }

  return segments;
}

/**
 * Pass 1: Oscillation thinning
 * Removes high-frequency direction reversals
 */
function thinOscillations(
  actions: FunscriptAction[],
  options: SmoothingOptions['oscillationDetection']
): FunscriptAction[] {
  if (actions.length < 3) return [...actions];

  const segments = detectOscillationSegments(actions, options.minReversals, options.maxIntervalMs);
  if (segments.length === 0) return [...actions];

  const toKeep = new Set<number>();
  const toRemove = new Set<number>();

  // Mark all indices as keep by default
  for (let i = 0; i < actions.length; i++) {
    toKeep.add(i);
  }

  // Process each oscillation segment
  for (const segment of segments) {
    const segmentActions = actions.slice(segment.startIndex, segment.endIndex + 1);

    // Calculate segment metrics
    const posRange = Math.max(...segmentActions.map(a => a.pos)) -
                    Math.min(...segmentActions.map(a => a.pos));

    const medianInterval = computeMedianInterval(segmentActions);

    // Only thin if range >= minRange AND median interval < threshold
    if (posRange >= options.minRange && medianInterval < options.avgIntervalThreshold) {
      // Keep first point, then alternate directions at targetInterval
      const segmentResult: number[] = [segment.startIndex];
      let lastKeptIndex = segment.startIndex;

      for (let i = segment.startIndex + 1; i <= segment.endIndex; i++) {
        const timeSinceLast = actions[i].at - actions[lastKeptIndex].at;

        if (timeSinceLast >= options.targetIntervalMs) {
          // Keep if it's been long enough (simple time-based thinning)
          segmentResult.push(i);
          lastKeptIndex = i;
        }
      }

      // Mark indices in this segment for removal unless in segmentResult
      for (let i = segment.startIndex; i <= segment.endIndex; i++) {
        if (!segmentResult.includes(i)) {
          toRemove.add(i);
          toKeep.delete(i);
        }
      }
    }
  }

  // Filter and cleanup duplicates
  const result = actions.filter((_, index) => toKeep.has(index));
  return cleanupDuplicates(result);
}

/**
 * Pass 2: Speed capping
 * Adjusts positions to ensure no transition exceeds maxSpeed
 */
function capSpeed(
  actions: FunscriptAction[],
  options: SmoothingOptions['speedCapping']
): FunscriptAction[] {
  if (actions.length < 3) return [...actions];

  let result = actions.map(a => ({ ...a })); // Deep copy

  for (let iteration = 0; iteration < options.maxIterations; iteration++) {
    let violationCount = 0;

    for (let i = 1; i < result.length - 1; i++) {
      const speedBefore = calculateSpeed(result[i - 1], result[i]);
      const speedAfter = calculateSpeed(result[i], result[i + 1]);

      if (speedBefore > options.maxSpeed || speedAfter > options.maxSpeed) {
        violationCount++;

        // Compute time-weighted linear interpolation between neighbors
        const prevPos = result[i - 1].pos;
        const nextPos = result[i + 1].pos;
        const prevTime = result[i - 1].at;
        const nextTime = result[i + 1].at;
        const currentTime = result[i].at;

        const t = (currentTime - prevTime) / (nextTime - prevTime);
        const interpolatedPos = prevPos + (nextPos - prevPos) * t;

        // Blend current position toward interpolated position
        result[i].pos = Math.round(
          result[i].pos * (1 - options.interpolationWeight) +
          interpolatedPos * options.interpolationWeight
        );
      }
    }

    // Convergence: no violations found
    if (violationCount === 0) break;
  }

  return result;
}

/**
 * Pass 3: Isolated spike removal
 * Removes direction-reversing points with fast transitions that are not part of sustained fast motion
 */
function removeIsolatedSpikes(
  actions: FunscriptAction[],
  options: SmoothingOptions['spikeRemoval']
): FunscriptAction[] {
  if (actions.length < 5) return [...actions];

  const toRemove = new Set<number>();

  for (let i = 2; i < actions.length - 2; i++) {
    const speedBefore = calculateSpeed(actions[i - 1], actions[i]);
    const speedAfter = calculateSpeed(actions[i], actions[i + 1]);
    const dtBefore = actions[i].at - actions[i - 1].at;
    const dtAfter = actions[i + 1].at - actions[i].at;

    // Check for direction reversal
    const deltaBefore = actions[i].pos - actions[i - 1].pos;
    const deltaAfter = actions[i + 1].pos - actions[i].pos;
    const isReversal = deltaBefore * deltaAfter < 0;

    if (!isReversal) continue;

    // At least one side is fast
    const isFastBefore = speedBefore > options.minSpeed && dtBefore < options.maxIntervalMs;
    const isFastAfter = speedAfter > options.minSpeed && dtAfter < options.maxIntervalMs;
    const hasFastTransition = isFastBefore || isFastAfter;

    if (!hasFastTransition) continue;

    // Check isolation: 2 steps away are not fast
    const speed2Before = calculateSpeed(actions[i - 2], actions[i - 1]);
    const speed2After = calculateSpeed(actions[i + 1], actions[i + 2]);
    const isFast2Before = speed2Before > options.minSpeed;
    const isFast2After = speed2After > options.minSpeed;
    const isIsolated = !isFast2Before && !isFast2After;

    if (isIsolated) {
      toRemove.add(i);
    }
  }

  const result = actions.filter((_, index) => !toRemove.has(index));
  return cleanupDuplicates(result);
}

/**
 * Remove consecutive same-position duplicates
 */
function cleanupDuplicates(actions: FunscriptAction[]): FunscriptAction[] {
  if (actions.length < 2) return actions;

  const result: FunscriptAction[] = [actions[0]];

  for (let i = 1; i < actions.length; i++) {
    // Only add if position differs from last kept action
    if (actions[i].pos !== result[result.length - 1].pos) {
      result.push(actions[i]);
    }
  }

  return result;
}

/**
 * Map intensity (0-100) to algorithm-specific thresholds
 */
export function intensityToOptions(intensity: number): SmoothingOptions {
  // Clamp intensity to 0-100
  const clampedIntensity = Math.max(0, Math.min(100, intensity));

  let oscillationMinReversals: number;
  let speedCapMaxSpeed: number;
  let spikeMinSpeed: number;

  if (clampedIntensity < 34) {
    // Conservative (0-33) - interpolate from conservative to moderate
    const t = clampedIntensity / 33;
    oscillationMinReversals = Math.round(10 - (10 - 4) * t);
    speedCapMaxSpeed = Math.round(200 - (200 - 180) * t);
    spikeMinSpeed = Math.round(120 - (120 - 90) * t);
  } else if (clampedIntensity < 67) {
    // Moderate (34-66) - use case study defaults
    oscillationMinReversals = 4;
    speedCapMaxSpeed = 180;
    spikeMinSpeed = 90;
  } else {
    // Aggressive (67-100) - interpolate from moderate to aggressive
    const t = (clampedIntensity - 67) / 33;
    oscillationMinReversals = Math.round(4 - (4 - 2) * t);
    speedCapMaxSpeed = Math.round(180 - (180 - 150) * t);
    spikeMinSpeed = Math.round(90 - (90 - 60) * t);
  }

  return {
    oscillationDetection: {
      minReversals: oscillationMinReversals,
      maxIntervalMs: DEFAULT_SMOOTHING_OPTIONS.oscillationDetection.maxIntervalMs,
      minRange: DEFAULT_SMOOTHING_OPTIONS.oscillationDetection.minRange,
      avgIntervalThreshold: DEFAULT_SMOOTHING_OPTIONS.oscillationDetection.avgIntervalThreshold,
      targetIntervalMs: DEFAULT_SMOOTHING_OPTIONS.oscillationDetection.targetIntervalMs,
    },
    speedCapping: {
      maxSpeed: speedCapMaxSpeed,
      interpolationWeight: DEFAULT_SMOOTHING_OPTIONS.speedCapping.interpolationWeight,
      maxIterations: DEFAULT_SMOOTHING_OPTIONS.speedCapping.maxIterations,
    },
    spikeRemoval: {
      minSpeed: spikeMinSpeed,
      maxIntervalMs: DEFAULT_SMOOTHING_OPTIONS.spikeRemoval.maxIntervalMs,
    },
  };
}

/**
 * Three-pass funscript smoothing orchestrator
 * Runs oscillation thinning, speed capping, and spike removal in sequence
 */
export function smoothFunscript(
  actions: FunscriptAction[],
  options: Partial<SmoothingOptions> = {}
): FunscriptAction[] {
  // Merge with defaults
  const opts: SmoothingOptions = {
    oscillationDetection: {
      ...DEFAULT_SMOOTHING_OPTIONS.oscillationDetection,
      ...options.oscillationDetection,
    },
    speedCapping: {
      ...DEFAULT_SMOOTHING_OPTIONS.speedCapping,
      ...options.speedCapping,
    },
    spikeRemoval: {
      ...DEFAULT_SMOOTHING_OPTIONS.spikeRemoval,
      ...options.spikeRemoval,
    },
  };

  // Run three passes in sequence
  let result = [...actions];
  result = thinOscillations(result, opts.oscillationDetection);
  result = capSpeed(result, opts.speedCapping);
  result = removeIsolatedSpikes(result, opts.spikeRemoval);

  return result;
}
