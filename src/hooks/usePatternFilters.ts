import { useMemo, useState } from 'react';
import type {
  PatternDefinition,
  CustomPatternDefinition,
  AnyPattern,
  Intensity,
  StyleTag,
  PatternDirection,
} from '@/types/patterns';
import { isCustomPattern } from '@/types/patterns';
import { getPatternDirection } from '@/lib/patternDefinitions';

/**
 * Pattern filtering hook with AND-logic across all filter dimensions
 *
 * Manages search text, intensity, style, and direction filters.
 * All filters start empty (showing all patterns).
 * Merges custom patterns with presets, prioritizing custom patterns in results.
 */
export function usePatternFilters(
  patterns: PatternDefinition[],
  customPatterns: CustomPatternDefinition[] = []
) {
  const [searchText, setSearchText] = useState('');
  const [intensities, setIntensities] = useState<Set<Intensity>>(new Set());
  const [styles, setStyles] = useState<Set<StyleTag>>(new Set());
  const [directions, setDirections] = useState<Set<PatternDirection>>(new Set());

  // Merge custom patterns with presets into AnyPattern array
  const allPatterns = useMemo<AnyPattern[]>(() => {
    // Map custom patterns to include a generator for compatibility
    const mappedCustomPatterns: AnyPattern[] = customPatterns.map((cp) => ({
      ...cp,
      generator: () => cp.actions,
    }));

    return [...mappedCustomPatterns, ...patterns];
  }, [customPatterns, patterns]);

  // Pre-compute pattern directions (memoized)
  const patternDirections = useMemo(() => {
    const directionMap = new Map<string, PatternDirection>();
    for (const pattern of allPatterns) {
      // For custom patterns, compute direction from actions
      const direction = isCustomPattern(pattern)
        ? getPatternDirection({ ...pattern, generator: () => pattern.actions })
        : getPatternDirection(pattern);
      directionMap.set(pattern.id, direction);
    }
    return directionMap;
  }, [allPatterns]);

  // Filter patterns with AND logic and sort (custom patterns first)
  const filteredPatterns = useMemo(() => {
    const filtered = allPatterns.filter((pattern) => {
      // Search filter: case-insensitive match on name or tags
      if (searchText.trim()) {
        const search = searchText.toLowerCase();
        const nameMatch = pattern.name.toLowerCase().includes(search);
        const tagMatch = pattern.tags.some((tag) =>
          tag.toLowerCase().includes(search)
        );
        if (!nameMatch && !tagMatch) return false;
      }

      // Intensity filter
      if (intensities.size > 0 && !intensities.has(pattern.intensity)) {
        return false;
      }

      // Style filter: pattern must have at least one matching tag
      if (styles.size > 0) {
        const hasMatchingTag = pattern.tags.some((tag) => styles.has(tag));
        if (!hasMatchingTag) return false;
      }

      // Direction filter
      if (directions.size > 0) {
        const patternDirection = patternDirections.get(pattern.id);
        if (!patternDirection || !directions.has(patternDirection)) {
          return false;
        }
      }

      return true;
    });

    // Sort: custom patterns first (by lastModified desc), then presets
    return filtered.sort((a, b) => {
      const aIsCustom = isCustomPattern(a);
      const bIsCustom = isCustomPattern(b);

      // Custom patterns come first
      if (aIsCustom && !bIsCustom) return -1;
      if (!aIsCustom && bIsCustom) return 1;

      // Both custom: sort by lastModified desc (newest first)
      if (aIsCustom && bIsCustom) {
        return b.lastModified - a.lastModified;
      }

      // Both presets: maintain existing order (no sorting)
      return 0;
    });
  }, [allPatterns, searchText, intensities, styles, directions, patternDirections]);

  // Toggle functions
  const toggleIntensity = (intensity: Intensity) => {
    setIntensities((prev) => {
      const next = new Set(prev);
      if (next.has(intensity)) {
        next.delete(intensity);
      } else {
        next.add(intensity);
      }
      return next;
    });
  };

  const toggleStyle = (style: StyleTag) => {
    setStyles((prev) => {
      const next = new Set(prev);
      if (next.has(style)) {
        next.delete(style);
      } else {
        next.add(style);
      }
      return next;
    });
  };

  const toggleDirection = (direction: PatternDirection) => {
    setDirections((prev) => {
      const next = new Set(prev);
      if (next.has(direction)) {
        next.delete(direction);
      } else {
        next.add(direction);
      }
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchText('');
    setIntensities(new Set());
    setStyles(new Set());
    setDirections(new Set());
  };

  // Check if any filters are active
  const hasActiveFilters =
    searchText.trim() !== '' ||
    intensities.size > 0 ||
    styles.size > 0 ||
    directions.size > 0;

  return {
    searchText,
    setSearchText,
    intensities,
    toggleIntensity,
    styles,
    toggleStyle,
    directions,
    toggleDirection,
    clearFilters,
    hasActiveFilters,
    filteredPatterns,
  };
}
