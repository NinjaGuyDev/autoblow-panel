import type { PatternDefinition } from '@/types/patterns';
import { PatternCard } from './PatternCard';

interface PatternGridProps {
  patterns: PatternDefinition[];
  totalCount: number;
  onPatternClick: (pattern: PatternDefinition) => void;
  onClearFilters: () => void;
}

/**
 * Responsive grid of pattern cards
 * Shows pattern count and empty state when no patterns match filters
 */
export function PatternGrid({
  patterns,
  totalCount,
  onPatternClick,
  onClearFilters,
}: PatternGridProps) {
  const isFiltered = patterns.length < totalCount;

  return (
    <div>
      {/* Pattern count */}
      <div className="mb-4 text-sm text-muted-foreground">
        {isFiltered
          ? `${patterns.length} of ${totalCount} patterns`
          : `${totalCount} patterns`}
      </div>

      {/* Empty state */}
      {patterns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No patterns found</p>
          <button
            onClick={onClearFilters}
            className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        // Grid of pattern cards
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              onClick={() => onPatternClick(pattern)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
