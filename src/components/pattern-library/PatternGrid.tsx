import type { AnyPattern } from '@/types/patterns';
import { isCustomPattern } from '@/types/patterns';
import { PatternCard } from './PatternCard';

interface PatternGridProps {
  patterns: AnyPattern[];
  totalCount: number;
  onPatternClick: (pattern: AnyPattern) => void;
  onClearFilters: () => void;
  isCreationMode?: boolean;
  onQuickAdd?: (pattern: AnyPattern) => void;
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
  isCreationMode = false,
  onQuickAdd,
}: PatternGridProps) {
  const isFiltered = patterns.length < totalCount;

  return (
    <div>
      {/* Pattern count */}
      <div className="mb-4 text-sm text-stone-500">
        {isFiltered
          ? `${patterns.length} of ${totalCount} patterns`
          : `${totalCount} patterns`}
      </div>

      {/* Empty state */}
      {patterns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-stone-500 mb-4">No patterns found</p>
          <button
            onClick={onClearFilters}
            className="px-4 py-2 rounded bg-amber-700 text-white hover:bg-amber-600 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        // Grid of pattern cards
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="relative">
              <PatternCard
                pattern={pattern}
                onClick={() => onPatternClick(pattern)}
                isCreationMode={isCreationMode}
                onQuickAdd={onQuickAdd ? () => onQuickAdd(pattern) : undefined}
              />
              {isCustomPattern(pattern) && (
                <div className="absolute top-2 right-2 bg-amber-700 text-white text-xs px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
                  Custom
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
