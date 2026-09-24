/**
 * Loads trainer patterns and records ranks for them, keeping each pattern's
 * average rank and rank count current.
 */

import { useState, useEffect, useCallback } from 'react';
import { trainerApi } from '@/lib/apiClient';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import type { TrainerPattern } from '@server/types/shared';

interface UseTrainerPatternsReturn {
  patterns: TrainerPattern[];
  loading: boolean;
  error: string | null;
  /**
   * Save one rank and return the pattern with refreshed stats.
   * @throws Error when the request fails (the error is also exposed as `error`).
   */
  recordRank: (patternId: number, rank: number) => Promise<TrainerPattern>;
}

export function useTrainerPatterns(): UseTrainerPatternsReturn {
  const [patterns, setPatterns] = useState<TrainerPattern[]>([]);
  const { loading, error, run, execute } = useAsyncOperation(true);

  useEffect(() => {
    run(() => trainerApi.getPatterns(), 'Failed to load trainer patterns')
      .then(setPatterns)
      .catch(() => setPatterns([]));
  }, [run]);

  const recordRank = useCallback(async (patternId: number, rank: number) => {
    const updated = await execute(() => trainerApi.rankPattern(patternId, rank), 'Failed to save rank');
    setPatterns(current => current.map(p => (p.id === updated.id ? updated : p)));
    return updated;
  }, [execute]);

  return { patterns, loading, error, recordRank };
}
