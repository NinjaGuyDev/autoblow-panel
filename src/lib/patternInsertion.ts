import type { FunscriptAction } from '@/types/funscript';
import type { PatternDefinition } from '@/types/patterns';

/**
 * Linear interpolation helper
 */
function lerp(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

/**
 * Inserts a pattern at the end of the existing actions array
 * @param currentActions Existing actions array
 * @param pattern Pattern definition to insert
 * @returns New actions array with pattern appended
 */
export function insertPatternAtEnd(
  currentActions: FunscriptAction[],
  pattern: PatternDefinition
): FunscriptAction[] {
  // Generate pattern actions
  const patternActions = pattern.generator();

  // Find max time in current actions (0 if empty)
  const maxTime =
    currentActions.length > 0
      ? Math.max(...currentActions.map((a) => a.at))
      : 0;

  // Offset pattern actions to start after current actions
  const offsetPatternActions = patternActions.map((action) => ({
    pos: action.pos,
    at: action.at + maxTime,
  }));

  // Merge and sort by time
  const merged = [...currentActions, ...offsetPatternActions];
  merged.sort((a, b) => a.at - b.at);

  return merged;
}

/**
 * Inserts a pattern at the cursor position with transition bridge
 * @param currentActions Existing actions array
 * @param pattern Pattern definition to insert
 * @param cursorTimeMs Cursor position in milliseconds
 * @returns New actions array with pattern inserted and existing actions shifted
 */
export function insertPatternAtCursor(
  currentActions: FunscriptAction[],
  pattern: PatternDefinition,
  cursorTimeMs: number
): FunscriptAction[] {
  // Generate pattern actions
  const patternActions = pattern.generator();

  // Offset pattern to start at cursor
  const offsetPatternActions = patternActions.map((action) => ({
    pos: action.pos,
    at: action.at + cursorTimeMs,
  }));

  // Split current actions into before and after cursor
  const beforeActions = currentActions.filter((a) => a.at < cursorTimeMs);
  const afterActions = currentActions.filter((a) => a.at >= cursorTimeMs);

  // Calculate shift amount: pattern duration + 1 second transition
  const patternDuration = pattern.durationMs;
  const transitionDuration = 1000;
  const shiftAmount = patternDuration + transitionDuration;

  // Shift all after actions
  const shiftedAfterActions = afterActions.map((action) => ({
    pos: action.pos,
    at: action.at + shiftAmount,
  }));

  // Create transition bridge between pattern end and first shifted action
  const transitionActions: FunscriptAction[] = [];
  if (offsetPatternActions.length > 0 && shiftedAfterActions.length > 0) {
    const patternEndPos = offsetPatternActions[offsetPatternActions.length - 1].pos;
    const patternEndTime = offsetPatternActions[offsetPatternActions.length - 1].at;
    const afterStartPos = shiftedAfterActions[0].pos;
    const afterStartTime = shiftedAfterActions[0].at;

    // Create 5 intermediate lerp points over 1 second
    const numIntermediatePoints = 5;
    for (let i = 1; i <= numIntermediatePoints; i++) {
      const t = i / (numIntermediatePoints + 1);
      const pos = lerp(patternEndPos, afterStartPos, t);
      const at = lerp(patternEndTime, afterStartTime, t);
      transitionActions.push({ pos, at });
    }
  }

  // Merge all arrays
  const merged = [
    ...beforeActions,
    ...offsetPatternActions,
    ...transitionActions,
    ...shiftedAfterActions,
  ];

  // Sort by time
  merged.sort((a, b) => a.at - b.at);

  // Deduplicate actions with identical time values (keep later one in source order)
  const deduplicated: FunscriptAction[] = [];
  const timeMap = new Map<number, FunscriptAction>();

  for (const action of merged) {
    timeMap.set(action.at, action);
  }

  // Convert map back to array and sort
  for (const [, action] of timeMap) {
    deduplicated.push(action);
  }
  deduplicated.sort((a, b) => a.at - b.at);

  // Ensure minimum 10ms spacing between adjacent actions
  const spacedActions: FunscriptAction[] = [];
  let lastTime = -Infinity;

  for (const action of deduplicated) {
    if (action.at - lastTime >= 10 || spacedActions.length === 0) {
      spacedActions.push({
        pos: Math.round(action.pos),
        at: action.at,
      });
      lastTime = action.at;
    }
  }

  return spacedActions;
}
