import type { FunscriptAction } from '@/types/funscript';
import type { ValidationResult, SegmentClassification } from '@/types/validation';

// Speed threshold constants (units per second)
export const SPEED_THRESHOLDS = {
  fast: 250,       // Above this = fast movement
  impossible: 400, // Above this = physically impossible
};

// Gap threshold (milliseconds)
export const GAP_THRESHOLD_MS = 3000; // 3 seconds

/**
 * Calculate speed between two consecutive actions
 * @param a1 First action
 * @param a2 Second action
 * @returns Speed in units per second (0-100 scale per second)
 */
export function calculateSpeed(a1: FunscriptAction, a2: FunscriptAction): number {
  const timeDiffMs = a2.at - a1.at;

  // Avoid division by zero
  if (timeDiffMs === 0) {
    return 0;
  }

  const positionDiff = Math.abs(a2.pos - a1.pos);
  // Convert to units per second: (units / milliseconds) * 1000
  const speed = (positionDiff / timeDiffMs) * 1000;

  return speed;
}

/**
 * Classify a segment based on speed
 */
function classifySegment(speed: number): SegmentClassification {
  if (speed > SPEED_THRESHOLDS.impossible) {
    return 'impossible';
  }
  if (speed > SPEED_THRESHOLDS.fast) {
    return 'fast';
  }
  return 'safe';
}

/**
 * Validate a funscript action array
 * Analyzes all consecutive action pairs for speed classification and timeline gaps
 * @param actions Full array of funscript actions (not filtered by viewport)
 * @returns ValidationResult with segments, gaps, and summary statistics
 */
export function validateFunscript(actions: FunscriptAction[]): ValidationResult {
  // Early return for insufficient data
  if (actions.length < 2) {
    return {
      segments: [],
      gaps: [],
      summary: {
        totalSegments: 0,
        safeCount: 0,
        fastCount: 0,
        impossibleCount: 0,
        gapCount: 0,
      },
    };
  }

  const segments = [];
  const gaps = [];
  let safeCount = 0;
  let fastCount = 0;
  let impossibleCount = 0;

  // Process each consecutive pair
  for (let i = 0; i < actions.length - 1; i++) {
    const currentAction = actions[i];
    const nextAction = actions[i + 1];

    const speed = calculateSpeed(currentAction, nextAction);
    const classification = classifySegment(speed);

    // Record segment
    segments.push({
      startIndex: i,
      endIndex: i + 1,
      classification,
      speed,
    });

    // Update counts
    if (classification === 'safe') safeCount++;
    else if (classification === 'fast') fastCount++;
    else if (classification === 'impossible') impossibleCount++;

    // Check for gaps (pauses > 3 seconds)
    const timeDiffMs = nextAction.at - currentAction.at;
    if (timeDiffMs > GAP_THRESHOLD_MS) {
      gaps.push({
        startIndex: i,
        endIndex: i + 1,
        durationMs: timeDiffMs,
      });
    }
  }

  return {
    segments,
    gaps,
    summary: {
      totalSegments: segments.length,
      safeCount,
      fastCount,
      impossibleCount,
      gapCount: gaps.length,
    },
  };
}
