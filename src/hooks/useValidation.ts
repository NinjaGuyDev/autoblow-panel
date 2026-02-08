import { useMemo } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { ValidationResult } from '@/types/validation';
import { validateFunscript } from '@/lib/funscriptValidator';

/**
 * Memoized validation hook for funscript action arrays
 * Recomputes validation only when actions reference changes
 * @param actions Full array of funscript actions
 * @returns ValidationResult with segments, gaps, and summary
 */
export function useValidation(actions: FunscriptAction[]): ValidationResult {
  return useMemo(() => {
    if (actions.length < 2) {
      return {
        segments: [],
        gaps: [],
        summary: {
          totalSegments: 0,
          safeCount: 0,
          fastCount: 0,
          impossibleCount: 0,
          gapCount: 0
        },
      };
    }
    return validateFunscript(actions);
  }, [actions]);
}
