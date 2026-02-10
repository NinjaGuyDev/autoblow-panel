import type { FunscriptAction } from '@/types/funscript';

/**
 * Interpolation type for waypoint-based pattern building
 */
export type InterpolationType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step';

/**
 * A waypoint definition for pattern building
 */
export interface WaypointDefinition {
  /** Position value (0-100) */
  pos: number;
  /** Time in milliseconds */
  timeMs: number;
  /** Interpolation type for segment from this waypoint to next */
  interpolation: InterpolationType;
}

/**
 * Intensity level of a motion pattern
 */
export type Intensity = 'low' | 'medium' | 'high';

/**
 * Direction of a motion pattern based on start and end positions
 */
export type PatternDirection = 'up' | 'down' | 'neutral';

/**
 * Style tags describing motion characteristics
 */
export type StyleTag =
  | 'wave'
  | 'pulse'
  | 'rhythmic'
  | 'random'
  | 'smooth'
  | 'stepped'
  | 'accelerating'
  | 'decelerating'
  | 'direct'
  | 'bounce'
  | 'surge'
  | 'stutter'
  | 'ramp'
  | 'zigzag'
  | 'plateau'
  | 'gradual'
  | 'incremental';

/**
 * A pattern definition with metadata and action generator
 */
export interface PatternDefinition {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Intensity level */
  intensity: Intensity;
  /** Style tags for filtering */
  tags: StyleTag[];
  /** Duration in milliseconds */
  durationMs: number;
  /** Generator function returning action array */
  generator: () => FunscriptAction[];
}

/**
 * A custom pattern definition with static actions instead of a generator
 * Used for user-created patterns that can be edited and saved
 */
export interface CustomPatternDefinition {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Intensity level */
  intensity: Intensity;
  /** Style tags for filtering */
  tags: StyleTag[];
  /** Duration in milliseconds */
  durationMs: number;
  /** Static array of actions (not a generator) */
  actions: FunscriptAction[];
  /** Literal true discriminator for type guards */
  isCustom: true;
  /** Preset pattern ID this was copied from */
  originalPatternId: string;
  /** Unix timestamp in milliseconds */
  lastModified: number;
  /** Backend library_items.id once saved */
  libraryItemId?: number;
}

/**
 * Union type for both preset and custom patterns
 */
export type AnyPattern = PatternDefinition | CustomPatternDefinition;

/**
 * Type guard to check if a pattern is a custom pattern
 * @param p Pattern to check
 * @returns True if pattern is a CustomPatternDefinition
 */
export function isCustomPattern(p: AnyPattern): p is CustomPatternDefinition {
  return 'isCustom' in p && p.isCustom === true;
}

/**
 * Extract actions from any pattern type (generator-based or static)
 */
export function getPatternActions(p: AnyPattern): FunscriptAction[] {
  return isCustomPattern(p) ? p.actions : p.generator();
}
