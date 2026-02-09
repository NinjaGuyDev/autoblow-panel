import type { Intensity, StyleTag, PatternDirection } from '@/types/patterns';
import { ALL_STYLE_TAGS } from '@/lib/patternDefinitions';

interface PatternFiltersProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  intensities: Set<Intensity>;
  onToggleIntensity: (intensity: Intensity) => void;
  styles: Set<StyleTag>;
  onToggleStyle: (style: StyleTag) => void;
  directions: Set<PatternDirection>;
  onToggleDirection: (direction: PatternDirection) => void;
}

/**
 * Search input and multi-select filter checkboxes
 * Organized into groups: intensity, style, direction
 */
export function PatternFilters({
  searchText,
  onSearchChange,
  intensities,
  onToggleIntensity,
  styles,
  onToggleStyle,
  directions,
  onToggleDirection,
}: PatternFiltersProps) {
  const intensityOptions: Intensity[] = ['low', 'medium', 'high'];
  const directionOptions: PatternDirection[] = ['up', 'down', 'neutral'];

  return (
    <div className="space-y-4 mb-6 p-4 border border-stone-800 rounded-lg bg-stone-900/50">
      {/* Search input */}
      <div>
        <input
          type="text"
          placeholder="Search patterns..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 rounded border border-stone-800 bg-stone-950 text-stone-200 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-700/40"
        />
      </div>

      {/* Filter groups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Intensity filter */}
        <div>
          <label className="text-sm font-medium text-stone-200 mb-2 block">
            Intensity
          </label>
          <div className="space-y-2">
            {intensityOptions.map((intensity) => (
              <label
                key={intensity}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={intensities.has(intensity)}
                  onChange={() => onToggleIntensity(intensity)}
                  className="w-4 h-4 rounded border-stone-800 text-amber-700 focus:ring-amber-700/40 focus:ring-offset-0"
                />
                <span className="text-sm text-stone-200 capitalize">
                  {intensity}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Style filter */}
        <div>
          <label className="text-sm font-medium text-stone-200 mb-2 block">
            Style
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {ALL_STYLE_TAGS.map((style) => (
              <label
                key={style}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={styles.has(style)}
                  onChange={() => onToggleStyle(style)}
                  className="w-4 h-4 rounded border-stone-800 text-amber-700 focus:ring-amber-700/40 focus:ring-offset-0"
                />
                <span className="text-sm text-stone-200 capitalize">
                  {style}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Direction filter */}
        <div>
          <label className="text-sm font-medium text-stone-200 mb-2 block">
            Direction
          </label>
          <div className="space-y-2">
            {directionOptions.map((direction) => (
              <label
                key={direction}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={directions.has(direction)}
                  onChange={() => onToggleDirection(direction)}
                  className="w-4 h-4 rounded border-stone-800 text-amber-700 focus:ring-amber-700/40 focus:ring-offset-0"
                />
                <span className="text-sm text-stone-200 capitalize">
                  {direction}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
