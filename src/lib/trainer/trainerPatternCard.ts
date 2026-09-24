/**
 * Adapts trainer patterns to the Patterns page card, so both pages render
 * patterns the same way.
 */

import type { TrainerPattern } from '@server/types/shared';
import type { PatternDefinition, StyleTag } from '@/types/patterns';

/** The tags the trainer extractor emits — all drawn from the Patterns page vocabulary. */
const TRAINER_TAGS: ReadonlySet<string> = new Set<StyleTag>(['pause', 'rhythmic', 'random', 'surge']);

function isTrainerTag(tag: string): tag is StyleTag {
  return TRAINER_TAGS.has(tag);
}

export function toPatternDefinition(pattern: TrainerPattern): PatternDefinition {
  return {
    id: `trainer-${pattern.id}`,
    name: pattern.name,
    intensity: pattern.intensity,
    tags: pattern.tags.filter(isTrainerTag),
    durationMs: pattern.durationMs,
    generator: () => pattern.actions,
  };
}

/** "7.3 avg · 4 ranks", or "Unranked". */
export function formatRankSummary(pattern: Pick<TrainerPattern, 'averageRank' | 'rankCount'>): string {
  if (pattern.averageRank === null || pattern.rankCount === 0) return 'Unranked';
  const ranks = pattern.rankCount === 1 ? 'rank' : 'ranks';
  return `${pattern.averageRank.toFixed(1)} avg · ${pattern.rankCount} ${ranks}`;
}
