import { useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { FunscriptAction } from '@/types/funscript';
import { humanizeFunscript, intensityToHumanizerOptions } from '@/lib/humanizer';

interface UseHumanizerOptions {
  actions: FunscriptAction[];
  selectedIndices: Set<number>;
}

interface HumanizerStats {
  affectedCount: number;
  totalCount: number;
}

interface UseHumanizerReturn {
  intensity: number;
  setIntensity: (value: number) => void;
  isPreviewActive: boolean;
  previewActions: FunscriptAction[];
  humanizerActive: boolean;
  stats: HumanizerStats | null;
  generatePreview: () => void;
  commitHumanizer: () => FunscriptAction[] | null;
  cancelPreview: () => void;
  openHumanizer: () => void;
  closeHumanizer: () => void;
}

export function useHumanizer({
  actions,
  selectedIndices,
}: UseHumanizerOptions): UseHumanizerReturn {
  const [intensity, setIntensityState] = useState(50);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [previewActions, setPreviewActions] = useState<FunscriptAction[]>([]);
  const [humanizerActive, setHumanizerActive] = useState(false);
  const [stats, setStats] = useState<HumanizerStats | null>(null);

  const generatePreview = useCallback(() => {
    const options = intensityToHumanizerOptions(intensity);

    let result: FunscriptAction[];

    if (selectedIndices.size > 0) {
      const selectedList = [...selectedIndices].sort((a, b) => a - b);
      const isContiguous = selectedList.every(
        (idx, i) => i === 0 || idx === selectedList[i - 1]! + 1
      );

      if (!isContiguous) {
        result = humanizeFunscript(actions, options);
      } else {
        const firstIdx = selectedList[0]!;
        const lastIdx = selectedList[selectedList.length - 1]!;
        const startIdx = Math.max(0, firstIdx - 2);
        const endIdx = Math.min(actions.length - 1, lastIdx + 2);

        const region = actions.slice(startIdx, endIdx + 1);
        const humanizedRegion = humanizeFunscript(region, options);

        result = [
          ...actions.slice(0, startIdx),
          ...humanizedRegion,
          ...actions.slice(endIdx + 1),
        ];
      }
    } else {
      result = humanizeFunscript(actions, options);
    }

    setPreviewActions(result);
    setStats({
      affectedCount: result.filter((a, i) => {
        const orig = actions[i];
        return orig && (a.pos !== orig.pos || a.at !== orig.at);
      }).length,
      totalCount: result.length,
    });
    setIsPreviewActive(true);
  }, [actions, selectedIndices, intensity]);

  // Re-generate preview (with fresh randomness) when intensity changes while active
  const debouncedGeneratePreview = useDebouncedCallback(generatePreview, 300);

  const setIntensity = useCallback(
    (value: number) => {
      setIntensityState(value);
      if (isPreviewActive) {
        debouncedGeneratePreview();
      }
    },
    [isPreviewActive, debouncedGeneratePreview]
  );

  const commitHumanizer = useCallback(() => {
    if (!isPreviewActive) return null;

    const result = previewActions;

    setIsPreviewActive(false);
    setHumanizerActive(false);
    setPreviewActions([]);
    setStats(null);
    setIntensityState(50);

    return result;
  }, [isPreviewActive, previewActions]);

  const cancelPreview = useCallback(() => {
    setIsPreviewActive(false);
    setPreviewActions([]);
    setStats(null);
  }, []);

  const openHumanizer = useCallback(() => {
    setHumanizerActive(true);
  }, []);

  const closeHumanizer = useCallback(() => {
    setHumanizerActive(false);
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
    humanizerActive,
    stats,
    generatePreview,
    commitHumanizer,
    cancelPreview,
    openHumanizer,
    closeHumanizer,
  };
}
