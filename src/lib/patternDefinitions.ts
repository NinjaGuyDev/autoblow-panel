import type { FunscriptAction } from '@/types/funscript';
import type {
  AnyPattern,
  PatternDefinition,
  PatternDirection,
  StyleTag,
  Intensity,
} from '@/types/patterns';
import { getPatternActions } from '@/types/patterns';

/**
 * All unique style tags used across pattern definitions
 * Exported for filter UI generation
 */
export const ALL_STYLE_TAGS: StyleTag[] = [
  'accelerating',
  'bounce',
  'decelerating',
  'direct',
  'gradual',
  'incremental',
  'plateau',
  'pulse',
  'ramp',
  'rhythmic',
  'smooth',
  'stepped',
  'stutter',
  'surge',
  'wave',
  'zigzag',
];

/**
 * Computes pattern direction based on start and end positions
 */
export function getPatternDirection(
  pattern: AnyPattern
): PatternDirection {
  const actions = getPatternActions(pattern);
  if (actions.length === 0) return 'neutral';

  const startPos = actions[0].pos;
  const endPos = actions[actions.length - 1].pos;

  if (endPos > startPos) return 'up';
  if (endPos < startPos) return 'down';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Pattern helpers
// ---------------------------------------------------------------------------

interface PatternMetadata {
  id: string;
  name: string;
  intensity: Intensity;
  tags: StyleTag[];
  durationMs: number;
}

/** Flip every pos value (100 − pos) to create the directional mirror. */
function mirrorActions(actions: FunscriptAction[]): FunscriptAction[] {
  return actions.map(({ at, pos }) => ({ at, pos: 100 - pos }));
}

/** Generate N+1 evenly-spaced points ramping from 0 → 100. */
function linearRamp(steps: number, durationMs: number): FunscriptAction[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    pos: Math.round((i / steps) * 100),
    at: Math.round((i / steps) * durationMs),
  }));
}

/**
 * Define a base pattern and its directional mirror in one call.
 * Returns [base, mirror] where the mirror has 100 − pos for every point.
 */
function patternPair(
  baseMeta: PatternMetadata,
  baseActions: FunscriptAction[],
  mirrorOverrides: { id: string; name: string },
): [PatternDefinition, PatternDefinition] {
  return [
    { ...baseMeta, generator: () => baseActions },
    { ...baseMeta, ...mirrorOverrides, generator: () => mirrorActions(baseActions) },
  ];
}

// ---------------------------------------------------------------------------
// Complete pattern library (36+ motion patterns, sorted by intensity)
// ---------------------------------------------------------------------------

export const PATTERN_DEFINITIONS: PatternDefinition[] = [
  // ── LOW INTENSITY ────────────────────────────────────────────────────

  ...patternPair(
    { id: 'gentle-wave-up', name: 'Gentle Wave Up', intensity: 'low', tags: ['wave', 'smooth', 'rhythmic'], durationMs: 23000 },
    [
      { pos: 0, at: 0 },
      { pos: 20, at: 3000 },
      { pos: 15, at: 5000 },
      { pos: 35, at: 8000 },
      { pos: 30, at: 10000 },
      { pos: 55, at: 13000 },
      { pos: 50, at: 15000 },
      { pos: 75, at: 18000 },
      { pos: 70, at: 20000 },
      { pos: 100, at: 23000 },
    ],
    { id: 'gentle-wave-down', name: 'Gentle Wave Down' },
  ),

  ...patternPair(
    { id: 'gradual-climb-up', name: 'Gradual Climb Up', intensity: 'low', tags: ['gradual', 'smooth'], durationMs: 30000 },
    [
      { pos: 0, at: 0 },
      { pos: 5, at: 3000 },
      { pos: 10, at: 6000 },
      { pos: 20, at: 9000 },
      { pos: 30, at: 12000 },
      { pos: 45, at: 15000 },
      { pos: 60, at: 18000 },
      { pos: 75, at: 21000 },
      { pos: 85, at: 24000 },
      { pos: 95, at: 27000 },
      { pos: 100, at: 30000 },
    ],
    { id: 'gradual-descent-down', name: 'Gradual Descent Down' },
  ),

  ...patternPair(
    { id: 'ramp-up-slow', name: 'Ramp Up Slow', intensity: 'low', tags: ['ramp', 'smooth', 'gradual'], durationMs: 20000 },
    linearRamp(10, 20000),
    { id: 'ramp-down-slow', name: 'Ramp Down Slow' },
  ),

  ...patternPair(
    { id: 'incremental-up-slow', name: 'Incremental Up Slow', intensity: 'low', tags: ['incremental', 'stepped'], durationMs: 10000 },
    linearRamp(10, 10000),
    { id: 'incremental-down-slow', name: 'Incremental Down Slow' },
  ),

  ...patternPair(
    { id: 'direct-up-8s', name: 'Direct Up 8s', intensity: 'low', tags: ['direct', 'smooth'], durationMs: 8000 },
    linearRamp(1, 8000),
    { id: 'direct-down-8s', name: 'Direct Down 8s' },
  ),

  // ── MEDIUM INTENSITY ─────────────────────────────────────────────────

  // Standalone pair — different shapes, not mirrors of each other
  {
    id: 'wave-up-slow',
    name: 'Wave Up Slow',
    intensity: 'medium',
    tags: ['wave', 'rhythmic'],
    durationMs: 17000,
    generator: () => [
      { pos: 0, at: 0 },
      { pos: 15, at: 2000 },
      { pos: 10, at: 3000 },
      { pos: 30, at: 5000 },
      { pos: 25, at: 6000 },
      { pos: 50, at: 8000 },
      { pos: 45, at: 9000 },
      { pos: 70, at: 11000 },
      { pos: 65, at: 12000 },
      { pos: 90, at: 14000 },
      { pos: 85, at: 15000 },
      { pos: 100, at: 17000 },
    ],
  },
  {
    id: 'wave-down-slow',
    name: 'Wave Down Slow',
    intensity: 'medium',
    tags: ['wave', 'rhythmic'],
    durationMs: 23000,
    generator: () => [
      { pos: 90, at: 3000 },
      { pos: 90, at: 3000 },
      { pos: 75, at: 4000 },
      { pos: 50, at: 6000 },
      { pos: 90, at: 8000 },
      { pos: 15, at: 12000 },
      { pos: 15, at: 15000 },
      { pos: 10, at: 17000 },
      { pos: 10, at: 17500 },
      { pos: 90, at: 20000 },
      { pos: 90, at: 21000 },
      { pos: 50, at: 23000 },
    ],
  },

  ...patternPair(
    { id: 'double-wave-up', name: 'Double Wave Up', intensity: 'medium', tags: ['wave', 'rhythmic'], durationMs: 20000 },
    [
      { pos: 0, at: 0 },
      { pos: 50, at: 4000 },
      { pos: 20, at: 8000 },
      { pos: 70, at: 12000 },
      { pos: 40, at: 16000 },
      { pos: 100, at: 20000 },
    ],
    { id: 'double-wave-down', name: 'Double Wave Down' },
  ),

  ...patternPair(
    { id: 'plateau-up', name: 'Plateau Up', intensity: 'medium', tags: ['plateau', 'smooth'], durationMs: 21000 },
    [
      { pos: 0, at: 0 },
      { pos: 25, at: 3000 },
      { pos: 25, at: 6000 },
      { pos: 50, at: 9000 },
      { pos: 50, at: 12000 },
      { pos: 75, at: 15000 },
      { pos: 75, at: 18000 },
      { pos: 100, at: 21000 },
    ],
    { id: 'plateau-down', name: 'Plateau Down' },
  ),

  ...patternPair(
    { id: 'stepped-up', name: 'Stepped Up', intensity: 'medium', tags: ['stepped'], durationMs: 19000 },
    [
      { pos: 0, at: 0 },
      { pos: 20, at: 3000 },
      { pos: 20, at: 4000 },
      { pos: 40, at: 7000 },
      { pos: 40, at: 8000 },
      { pos: 60, at: 11000 },
      { pos: 60, at: 12000 },
      { pos: 80, at: 15000 },
      { pos: 80, at: 16000 },
      { pos: 100, at: 19000 },
    ],
    { id: 'stepped-down', name: 'Stepped Down' },
  ),

  ...patternPair(
    { id: 'bounce-up', name: 'Bounce Up', intensity: 'medium', tags: ['bounce', 'rhythmic'], durationMs: 18000 },
    [
      { pos: 0, at: 0 },
      { pos: 30, at: 3000 },
      { pos: 10, at: 6000 },
      { pos: 40, at: 9000 },
      { pos: 60, at: 12000 },
      { pos: 80, at: 15000 },
      { pos: 100, at: 18000 },
    ],
    { id: 'bounce-down', name: 'Bounce Down' },
  ),

  ...patternPair(
    { id: 'peak-valley-down', name: 'Peak Valley Down', intensity: 'medium', tags: ['wave', 'rhythmic'], durationMs: 21000 },
    [
      { pos: 100, at: 0 },
      { pos: 95, at: 3000 },
      { pos: 90, at: 6000 },
      { pos: 85, at: 9000 },
      { pos: 60, at: 12000 },
      { pos: 35, at: 15000 },
      { pos: 15, at: 18000 },
      { pos: 0, at: 21000 },
    ],
    { id: 'valley-peak-up', name: 'Valley Peak Up' },
  ),

  // ── HIGH INTENSITY ───────────────────────────────────────────────────

  ...patternPair(
    { id: 'surge-up', name: 'Surge Up', intensity: 'high', tags: ['surge', 'pulse'], durationMs: 14000 },
    [
      { pos: 0, at: 0 },
      { pos: 0, at: 2000 },
      { pos: 35, at: 4000 },
      { pos: 35, at: 7000 },
      { pos: 65, at: 9000 },
      { pos: 65, at: 12000 },
      { pos: 100, at: 14000 },
    ],
    { id: 'surge-down', name: 'Surge Down' },
  ),

  ...patternPair(
    { id: 'stutter-up', name: 'Stutter Up', intensity: 'high', tags: ['stutter', 'rhythmic'], durationMs: 20000 },
    [
      { pos: 0, at: 0 },
      { pos: 15, at: 2000 },
      { pos: 10, at: 3000 },
      { pos: 30, at: 5000 },
      { pos: 25, at: 6000 },
      { pos: 45, at: 8000 },
      { pos: 40, at: 9000 },
      { pos: 60, at: 11000 },
      { pos: 55, at: 12000 },
      { pos: 75, at: 14000 },
      { pos: 70, at: 15000 },
      { pos: 90, at: 17000 },
      { pos: 85, at: 18000 },
      { pos: 100, at: 20000 },
    ],
    { id: 'stutter-down', name: 'Stutter Down' },
  ),

  ...patternPair(
    { id: 'zigzag-up', name: 'Zigzag Up', intensity: 'high', tags: ['zigzag', 'rhythmic'], durationMs: 17000 },
    [
      { pos: 0, at: 0 },
      { pos: 20, at: 2000 },
      { pos: 15, at: 3000 },
      { pos: 35, at: 5000 },
      { pos: 30, at: 6000 },
      { pos: 50, at: 8000 },
      { pos: 45, at: 9000 },
      { pos: 65, at: 11000 },
      { pos: 60, at: 12000 },
      { pos: 80, at: 14000 },
      { pos: 75, at: 15000 },
      { pos: 100, at: 17000 },
    ],
    { id: 'zigzag-down', name: 'Zigzag Down' },
  ),

  ...patternPair(
    { id: 'accelerating-up', name: 'Accelerating Up', intensity: 'high', tags: ['accelerating', 'rhythmic'], durationMs: 13000 },
    [
      { pos: 0, at: 0 },
      { pos: 10, at: 4000 },
      { pos: 25, at: 7000 },
      { pos: 45, at: 9500 },
      { pos: 70, at: 11500 },
      { pos: 100, at: 13000 },
    ],
    { id: 'accelerating-down', name: 'Accelerating Down' },
  ),

  ...patternPair(
    { id: 'decelerating-up', name: 'Decelerating Up', intensity: 'high', tags: ['decelerating', 'rhythmic'], durationMs: 17000 },
    [
      { pos: 0, at: 0 },
      { pos: 30, at: 2000 },
      { pos: 55, at: 4000 },
      { pos: 70, at: 6500 },
      { pos: 80, at: 9500 },
      { pos: 90, at: 13000 },
      { pos: 100, at: 17000 },
    ],
    { id: 'decelerating-down', name: 'Decelerating Down' },
  ),

  ...patternPair(
    { id: 'triple-wave-up', name: 'Triple Wave Up', intensity: 'high', tags: ['wave', 'rhythmic'], durationMs: 21000 },
    [
      { pos: 0, at: 0 },
      { pos: 35, at: 3000 },
      { pos: 15, at: 6000 },
      { pos: 55, at: 9000 },
      { pos: 35, at: 12000 },
      { pos: 75, at: 15000 },
      { pos: 55, at: 18000 },
      { pos: 100, at: 21000 },
    ],
    { id: 'triple-wave-down', name: 'Triple Wave Down' },
  ),

  // ── GENERATED PATTERNS ───────────────────────────────────────────────

  {
    id: 'slow-sine-wave',
    name: 'Slow Sine Wave',
    intensity: 'low',
    tags: ['wave', 'smooth', 'rhythmic'],
    durationMs: 10000,
    generator: () => {
      const actions: FunscriptAction[] = [];
      const duration = 10000;
      const interval = 200;
      for (let t = 0; t <= duration; t += interval) {
        const pos = Math.round(50 + 50 * Math.sin((t / duration) * Math.PI * 2));
        actions.push({ pos, at: t });
      }
      return actions;
    },
  },
  {
    id: 'rapid-pulse',
    name: 'Rapid Pulse',
    intensity: 'high',
    tags: ['pulse', 'rhythmic'],
    durationMs: 5000,
    generator: () => {
      const actions: FunscriptAction[] = [];
      const duration = 5000;
      const interval = 250;
      let toggle = true;
      for (let t = 0; t <= duration; t += interval) {
        const pos = toggle ? 100 : 0;
        actions.push({ pos, at: t });
        toggle = !toggle;
      }
      return actions;
    },
  },
];
