import { useState, useEffect } from 'react';

export const OFFSET_STEP_MS = 50;

interface UseManualSyncReturn {
  offsetMs: number;
  setOffsetMs: (offset: number) => void;
  resetOffset: () => void;
  OFFSET_STEP_MS: number;
}

/**
 * Hook for managing manual sync offset with keyboard controls
 * Used when auto-sync is not available for embedded platforms
 */
export function useManualSync(enabled: boolean): UseManualSyncReturn {
  const [offsetMs, setOffsetMs] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts when user is typing in input fields
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setOffsetMs((prev) => prev + OFFSET_STEP_MS);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setOffsetMs((prev) => prev - OFFSET_STEP_MS);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);

  const resetOffset = () => setOffsetMs(0);

  return {
    offsetMs,
    setOffsetMs,
    resetOffset,
    OFFSET_STEP_MS,
  };
}
