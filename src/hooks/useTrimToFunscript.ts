import { useCallback } from 'react';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { mediaApi } from '@/lib/apiClient';
import type { TrimToFunscriptRequest, TrimToFunscriptResult } from '@server/types/shared';

interface UseTrimToFunscriptReturn {
  isTrimming: boolean;
  /** Why the last trim failed, as reported by the server */
  error: string | null;
  trim: (request: TrimToFunscriptRequest) => Promise<void>;
  clearError: () => void;
}

/**
 * Runs "Trim to funscript" and hands the new library item to onTrimmed,
 * along with the request it answers so the caller can tell whether the
 * same video is still loaded. Failures land in `error` rather than being thrown.
 */
export function useTrimToFunscript(
  onTrimmed: (result: TrimToFunscriptResult, request: TrimToFunscriptRequest) => void,
): UseTrimToFunscriptReturn {
  const { loading, error, run, clearError } = useAsyncOperation();

  const trim = useCallback(async (request: TrimToFunscriptRequest) => {
    let result: TrimToFunscriptResult;
    try {
      result = await run(() => mediaApi.trimToFunscript(request), 'Trim to funscript failed');
    } catch {
      // run() has already recorded the message in `error`
      return;
    }
    onTrimmed(result, request);
  }, [run, onTrimmed]);

  return { isTrimming: loading, error, trim, clearError };
}
