import type { FunscriptAction } from '@/types/funscript';
import type { PatternDefinition } from '@/types/patterns';

/**
 * Linear interpolation helper
 */
function lerp(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

/**
 * Creates smooth transition points between two positions
 * @param startPos Starting position (0-100)
 * @param endPos Ending position (0-100)
 * @param startTime Starting time in ms
 * @param endTime Ending time in ms (if provided, overrides spacing calculation)
 * @returns Array of transition actions
 */
function createSmoothTransition(
  startPos: number,
  endPos: number,
  startTime: number,
  endTime?: number
): FunscriptAction[] {
  const posDiff = Math.abs(endPos - startPos);

  // 1 point for every 10 units of position difference
  const numPoints = Math.max(0, Math.floor(posDiff / 10));

  if (numPoints === 0) {
    return [];
  }

  const transitionActions: FunscriptAction[] = [];
  const spacing = 750; // 0.75 seconds between points

  for (let i = 1; i <= numPoints; i++) {
    const t = i / (numPoints + 1); // Distribute evenly between start and end
    const pos = lerp(startPos, endPos, t);
    const at = endTime
      ? lerp(startTime, endTime, t)
      : startTime + (i * spacing);
    transitionActions.push({ pos, at });
  }

  return transitionActions;
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
  if (patternActions.length === 0) return currentActions;

  // Find max time and last position in current actions
  const maxTime =
    currentActions.length > 0
      ? Math.max(...currentActions.map((a) => a.at))
      : 0;

  const lastPos =
    currentActions.length > 0
      ? currentActions[currentActions.length - 1].pos
      : patternActions[0].pos; // If no existing actions, no smoothing needed

  // Create smooth transition from last position to pattern start
  const smoothingActions: FunscriptAction[] = [];
  if (currentActions.length > 0) {
    const patternStartPos = patternActions[0].pos;
    const transitionPoints = createSmoothTransition(
      lastPos,
      patternStartPos,
      maxTime
    );

    // Calculate total smoothing duration
    const smoothingDuration = transitionPoints.length * 750;

    // Offset pattern to start after smoothing
    const patternStartTime = maxTime + smoothingDuration;
    const offsetPatternActions = patternActions.map((action) => ({
      pos: action.pos,
      at: action.at + patternStartTime,
    }));

    // Merge all parts
    const merged = [
      ...currentActions,
      ...transitionPoints,
      ...offsetPatternActions,
    ];
    merged.sort((a, b) => a.at - b.at);
    return merged;
  } else {
    // No existing actions, just add the pattern
    const offsetPatternActions = patternActions.map((action) => ({
      pos: action.pos,
      at: action.at + maxTime,
    }));
    return offsetPatternActions;
  }
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

  // Calculate smoothing transition if there are after actions
  let transitionActions: FunscriptAction[] = [];
  let transitionDuration = 0;

  if (offsetPatternActions.length > 0 && afterActions.length > 0) {
    const patternEndPos = offsetPatternActions[offsetPatternActions.length - 1].pos;
    const patternEndTime = offsetPatternActions[offsetPatternActions.length - 1].at;
    const afterStartPos = afterActions[0].pos;

    // Create smooth transition from pattern end to after actions start
    transitionActions = createSmoothTransition(
      patternEndPos,
      afterStartPos,
      patternEndTime
    );

    // Calculate transition duration
    transitionDuration = transitionActions.length * 750;
  }

  // Calculate total shift amount: pattern duration + transition duration
  const patternDuration = pattern.durationMs;
  const shiftAmount = patternDuration + transitionDuration;

  // Shift all after actions
  const shiftedAfterActions = afterActions.map((action) => ({
    pos: action.pos,
    at: action.at + shiftAmount,
  }));

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
