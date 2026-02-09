import { useState, useCallback } from 'react';
import { getErrorMessage } from '@/lib/getErrorMessage';

interface UseAsyncOperationReturn {
  loading: boolean;
  error: string | null;
  /** Run an async operation with loading state tracking (for primary data fetches). */
  run: <T>(operation: () => Promise<T>, errorContext: string) => Promise<T>;
  /** Execute an async operation without loading tracking (for mutations/actions). */
  execute: <T>(operation: () => Promise<T>, errorContext: string) => Promise<T>;
  clearError: () => void;
}

/**
 * Manages loading/error state for async operations.
 *
 * - `run` sets loading=true while the operation is in-flight (use for data fetches).
 * - `execute` only manages the error state (use for one-shot mutations).
 * - Both clear the previous error before starting and re-throw on failure.
 */
export function useAsyncOperation(initialLoading = false): UseAsyncOperationReturn {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(
    operation: () => Promise<T>,
    errorContext: string,
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await operation();
    } catch (err) {
      setError(getErrorMessage(err, errorContext));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const execute = useCallback(async <T>(
    operation: () => Promise<T>,
    errorContext: string,
  ): Promise<T> => {
    setError(null);
    try {
      return await operation();
    } catch (err) {
      setError(getErrorMessage(err, errorContext));
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, run, execute, clearError };
}
