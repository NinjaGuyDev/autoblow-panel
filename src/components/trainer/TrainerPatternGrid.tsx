import { memo, useMemo } from 'react';
import type { TrainerPattern } from '@server/types/shared';
import { PatternCard } from '@/components/pattern-library/PatternCard';
import { formatRankSummary, toPatternDefinition } from '@/lib/trainer/trainerPatternCard';
import { cn } from '@/lib/utils';

export type TrainerSortOrder = 'family' | 'rank';

interface TrainerPatternGridProps {
  patterns: TrainerPattern[];
  currentPatternId: number | null;
  sortOrder: TrainerSortOrder;
}

/** Highest average first; unranked patterns last. */
function byRank(a: TrainerPattern, b: TrainerPattern): number {
  if (a.averageRank === null || b.averageRank === null) {
    return (a.averageRank === null ? 1 : 0) - (b.averageRank === null ? 1 : 0);
  }
  return b.averageRank - a.averageRank || b.rankCount - a.rankCount;
}

/**
 * Trainer patterns laid out like the Patterns page, each card carrying its
 * average rank. Memoized — the page re-renders every animation frame while playing.
 */
export const TrainerPatternGrid = memo(function TrainerPatternGrid({
  patterns,
  currentPatternId,
  sortOrder,
}: TrainerPatternGridProps) {
  const cards = useMemo(() => {
    const ordered = sortOrder === 'rank' ? [...patterns].sort(byRank) : patterns;
    return ordered.map(pattern => ({ pattern, definition: toPatternDefinition(pattern) }));
  }, [patterns, sortOrder]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {cards.map(({ pattern, definition }) => (
        <div
          key={pattern.id}
          className={cn('relative rounded-lg', pattern.id === currentPatternId && 'ring-2 ring-amber-500')}
        >
          <PatternCard pattern={definition} />
          <div
            className={cn(
              'absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded shadow-sm pointer-events-none',
              pattern.rankCount > 0 ? 'bg-amber-700 text-white' : 'bg-stone-800 text-stone-400',
            )}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {formatRankSummary(pattern)}
          </div>
        </div>
      ))}
    </div>
  );
});
