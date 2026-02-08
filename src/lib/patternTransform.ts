import type { FunscriptAction } from '@/types/funscript';
import type { PatternDefinition, CustomPatternDefinition } from '@/types/patterns';
import { createSmoothTransition } from '@/lib/patternInsertion';

/**
 * Scales pattern duration proportionally using multiplicative factor
 * Preserves relative timing between actions
 *
 * @param actions Array of funscript actions to scale
 * @param newDurationMs Target duration in milliseconds
 * @returns New array with scaled timestamps
 */
export function scalePatternDuration(
  actions: FunscriptAction[],
  newDurationMs: number
): FunscriptAction[] {
  // Empty array case
  if (actions.length === 0) {
    return [];
  }

  // Single point cannot be scaled
  if (actions.length === 1) {
    return [...actions];
  }

  // Calculate original duration
  const firstAction = actions[0];
  const lastAction = actions[actions.length - 1];
  const originalDuration = lastAction.at - firstAction.at;

  // Cannot scale zero-duration pattern (avoid division by zero)
  if (originalDuration === 0) {
    return [...actions];
  }

  // Calculate multiplicative scale factor
  const scale = newDurationMs / originalDuration;

  // Apply scale to all timestamps, preserving relative proportions
  return actions.map((action) => ({
    pos: action.pos,
    at: Math.round(firstAction.at + (action.at - firstAction.at) * scale),
  }));
}

/**
 * Adjusts pattern intensity by shifting positions away from center
 * Preserves first and last action positions exactly
 *
 * @param actions Array of funscript actions to adjust
 * @param delta Intensity adjustment amount (typically +10 or -10)
 * @returns New array with adjusted positions
 */
export function adjustIntensity(
  actions: FunscriptAction[],
  delta: number
): FunscriptAction[] {
  // Empty array case
  if (actions.length === 0) {
    return [];
  }

  return actions.map((action, index) => {
    // Preserve first and last positions exactly
    if (index === 0 || index === actions.length - 1) {
      return { ...action };
    }

    // Determine direction: positions >= 50 move up, < 50 move down
    const direction = action.pos >= 50 ? 1 : -1;

    // Apply delta in the appropriate direction
    const newPos = action.pos + direction * Math.abs(delta);

    // Clamp to valid position range [0, 100]
    const clampedPos = Math.max(0, Math.min(100, newPos));

    return {
      pos: clampedPos,
      at: action.at,
    };
  });
}

/**
 * Creates smooth transition actions from pattern end back to pattern start
 * Used to create seamless loops for repeating patterns
 *
 * @param actions Array of funscript actions representing a pattern
 * @returns Array of transition actions to bridge end to start
 */
export function createLoopTransition(
  actions: FunscriptAction[]
): FunscriptAction[] {
  // Empty array case
  if (actions.length === 0) {
    return [];
  }

  const firstAction = actions[0];
  const lastAction = actions[actions.length - 1];
  const endPos = lastAction.pos;
  const startPos = firstAction.pos;

  // No transition needed if positions match
  if (endPos === startPos) {
    return [];
  }

  const endTime = lastAction.at;
  const totalPatternDuration = endTime - firstAction.at;

  // Transition duration is 10% of pattern duration, max 750ms
  const transitionDuration = Math.min(750, totalPatternDuration * 0.1);

  // Use existing smooth transition function from patternInsertion
  return createSmoothTransition(
    endPos,
    startPos,
    endTime,
    endTime + transitionDuration
  );
}

/**
 * Creates an editable copy of a preset pattern
 * Converts generator-based pattern to static actions array
 *
 * @param preset Preset pattern definition to copy
 * @returns Custom pattern definition with static actions
 */
export function createEditableCopy(
  preset: PatternDefinition
): CustomPatternDefinition {
  // Generate actions from preset
  const actions = preset.generator();

  return {
    id: `custom-${Date.now()}`,
    name: `${preset.name} (Copy)`,
    intensity: preset.intensity,
    tags: [...preset.tags],
    durationMs: preset.durationMs,
    actions,
    isCustom: true,
    originalPatternId: preset.id,
    lastModified: Date.now(),
  };
}
