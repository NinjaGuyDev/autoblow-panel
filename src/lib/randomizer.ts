import type { FunscriptAction } from '@/types/funscript';
import type { AnyPattern } from '@/types/patterns';
import type { RandomizedScript, RandomizedSegment } from '@/types/randomizer';
import { getPatternActions, isCustomPattern } from '@/types/patterns';

const TRANSITION_DURATION_MS = 300;
const TRANSITION_STEPS = 5;

export function generateRandomizedScript(
  patterns: AnyPattern[],
  desiredDurationMs: number,
): RandomizedScript {
  if (patterns.length === 0) {
    return { actions: [], segments: [], totalDurationMs: 0 };
  }

  const allActions: FunscriptAction[] = [];
  const segments: RandomizedSegment[] = [];
  const usageCount = new Map<string, number>();
  let currentTimeMs = 0;

  // Pre-filter to patterns that actually have actions
  const viablePatterns = patterns.filter((p) => getPatternActions(p).length > 0);
  if (viablePatterns.length === 0) {
    return { actions: [], segments: [], totalDurationMs: 0 };
  }

  while (true) {
    const picked = weightedRandomPick(viablePatterns, usageCount);
    const patternActions = getPatternActions(picked);

    // Insert smooth transition if needed
    if (allActions.length > 0) {
      const lastPos = allActions[allActions.length - 1].pos;
      const firstPos = patternActions[0].pos;
      if (lastPos !== firstPos) {
        const lastTime = allActions[allActions.length - 1].at;
        for (let i = 1; i <= TRANSITION_STEPS; i++) {
          const t = i / TRANSITION_STEPS;
          allActions.push({
            pos: Math.round(lastPos + (firstPos - lastPos) * t),
            at: lastTime + Math.round(TRANSITION_DURATION_MS * t),
          });
        }
        currentTimeMs = allActions[allActions.length - 1].at;
      }
    }

    // Time-shift and append pattern actions
    const segmentStartMs = currentTimeMs;
    for (const action of patternActions) {
      allActions.push({
        pos: action.pos,
        at: currentTimeMs + action.at,
      });
    }
    const segmentEndMs = allActions[allActions.length - 1].at;
    currentTimeMs = segmentEndMs;

    const audioFile = isCustomPattern(picked) ? picked.audioFile : undefined;
    segments.push({
      patternName: picked.name,
      patternId: picked.id,
      startMs: segmentStartMs,
      endMs: segmentEndMs,
      audioFile,
    });

    usageCount.set(picked.id, (usageCount.get(picked.id) ?? 0) + 1);

    if (currentTimeMs >= desiredDurationMs) {
      break;
    }
  }

  return {
    actions: allActions,
    segments,
    totalDurationMs: currentTimeMs,
  };
}

function weightedRandomPick(patterns: AnyPattern[], usageCount: Map<string, number>): AnyPattern {
  const weights = patterns.map((p) => {
    const uses = usageCount.get(p.id) ?? 0;
    if (uses === 0) return 3;
    if (uses === 1) return 1;
    return 0.5;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < patterns.length; i++) {
    random -= weights[i];
    if (random <= 0) return patterns[i];
  }

  return patterns[patterns.length - 1];
}
