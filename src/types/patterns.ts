import type { FunscriptAction } from '@/types/funscript';

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
