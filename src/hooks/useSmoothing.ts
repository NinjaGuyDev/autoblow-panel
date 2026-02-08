import { useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { FunscriptAction } from '@/types/funscript';
import { smoothFunscript, intensityToOptions } from '@/lib/smoothing';

interface UseSmoothingOptions {
  actions: FunscriptAction[];
  selectedIndices: Set<number>;
}

interface SmoothingStats {
  originalCount: number;
  smoothedCount: number;
}

interface UseSmoothingReturn {
  intensity: number;
  setIntensity: (value: number) => void;
  isPreviewActive: boolean;
  previewActions: FunscriptAction[];
  smoothingActive: boolean;
  stats: SmoothingStats | null;
  generatePreview: () => void;
  commitSmoothing: () => FunscriptAction[] | null;
  cancelPreview: () => void;
  openSmoothing: () => void;
  closeSmoothing: () => void;
}

export function useSmoothing({
  actions,
  selectedIndices,
}: UseSmoothingOptions): UseSmoothingReturn {
  const [intensity, setIntensityState] = useState(50);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [previewActions, setPreviewActions] = useState<FunscriptAction[]>([]);
  const [smoothingActive, setSmoothingActive] = useState(false);
  const [stats, setStats] = useState<SmoothingStats | null>(null);

  // Generate preview by smoothing selected region or entire script
  const generatePreview = useCallback(() => {
    const options = intensityToOptions(intensity);

    let result: FunscriptAction[];
    let originalCount: number;

    if (selectedIndices.size > 0) {
      // Region-aware smoothing: extract selected actions, smooth them, merge back
      const selectedActionsList: Array<{ index: number; action: FunscriptAction }> = [];
      selectedIndices.forEach((index) => {
        selectedActionsList.push({ index, action: actions[index] });
      });

      // Sort by index to ensure contiguous region
      selectedActionsList.sort((a, b) => a.index - b.index);

      // Check if selection is contiguous
      const isContiguous = selectedActionsList.every((item, i) => {
        if (i === 0) return true;
        return item.index === selectedActionsList[i - 1].index + 1;
      });

      if (!isContiguous) {
        // For non-contiguous selections, treat as entire script for now
        // (Could enhance later to smooth multiple contiguous segments)
        result = smoothFunscript(actions, options);
        originalCount = actions.length;
      } else {
        // Extract selected actions with buffer points for algorithm context
        const firstSelectedIndex = selectedActionsList[0].index;
        const lastSelectedIndex = selectedActionsList[selectedActionsList.length - 1].index;

        // Include 2 buffer points on each side for algorithm context
        const startIndex = Math.max(0, firstSelectedIndex - 2);
        const endIndex = Math.min(actions.length - 1, lastSelectedIndex + 2);

        const regionActions = actions.slice(startIndex, endIndex + 1);
        originalCount = regionActions.length;

        // Smooth the region
        const smoothedRegion = smoothFunscript(regionActions, options);

        // Merge back into full array
        result = [
          ...actions.slice(0, startIndex),
          ...smoothedRegion,
          ...actions.slice(endIndex + 1),
        ];
      }
    } else {
      // Smooth entire script
      originalCount = actions.length;
      result = smoothFunscript(actions, options);
    }

    setPreviewActions(result);
    setStats({
      originalCount,
      smoothedCount: result.length,
    });
    setIsPreviewActive(true);
  }, [actions, selectedIndices, intensity]);

  // Debounced auto-preview when intensity changes while preview is active
  const debouncedGeneratePreview = useDebouncedCallback(generatePreview, 300);

  const setIntensity = useCallback(
    (value: number) => {
      setIntensityState(value);
      // Auto-regenerate preview if already active
      if (isPreviewActive) {
        debouncedGeneratePreview();
      }
    },
    [isPreviewActive, debouncedGeneratePreview]
  );

  // Commit smoothing - returns preview actions for caller to pass to setActions()
  const commitSmoothing = useCallback(() => {
    if (!isPreviewActive) return null;

    const result = previewActions;

    // Reset state
    setIsPreviewActive(false);
    setSmoothingActive(false);
    setPreviewActions([]);
    setStats(null);
    setIntensityState(50);

    return result;
  }, [isPreviewActive, previewActions]);

  // Cancel preview - discard smoothed result without calling setActions
  const cancelPreview = useCallback(() => {
    setIsPreviewActive(false);
    setPreviewActions([]);
    setStats(null);
  }, []);

  // Open/close smoothing panel
  const openSmoothing = useCallback(() => {
    setSmoothingActive(true);
  }, []);

  const closeSmoothing = useCallback(() => {
    setSmoothingActive(false);
    setIsPreviewActive(false);
    setPreviewActions([]);
    setStats(null);
    setIntensityState(50);
  }, []);

  return {
    intensity,
    setIntensity,
    isPreviewActive,
    previewActions,
    smoothingActive,
    stats,
    generatePreview,
    commitSmoothing,
    cancelPreview,
    openSmoothing,
    closeSmoothing,
  };
}
