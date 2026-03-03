/**
 * ClimaxPromptOverlay
 *
 * Non-blocking toast that appears immediately after the user pauses a script.
 * Asks "Did you climax?" and waits for Yes/No.
 *
 * Behaviour:
 *   - Auto-dismisses as No after AUTO_DISMISS_MS
 *   - Calling onNo (or letting it auto-dismiss) closes without recording
 *   - The parent is responsible for hiding this when isPaused → false
 *     (unpausing before answering = No)
 */

import { useEffect, useState } from 'react';

const AUTO_DISMISS_MS = 8000;

interface ClimaxPromptOverlayProps {
  onYes: () => void;
  onNo: () => void;
}

export function ClimaxPromptOverlay({ onYes, onNo }: ClimaxPromptOverlayProps) {
  const [remaining, setRemaining] = useState(AUTO_DISMISS_MS / 1000);

  // Countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(interval);
          onNo();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onNo]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-80">
      <div className="bg-stone-900 border border-stone-600 rounded-xl p-4 shadow-2xl">
        <p className="text-stone-200 text-sm font-medium mb-3 text-center">
          Did you climax?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onYes}
            className="flex-1 px-3 py-2 rounded-lg bg-rose-700 text-white text-sm font-medium hover:bg-rose-600 transition-colors"
          >
            Yes, record it
          </button>
          <button
            onClick={onNo}
            className="px-3 py-2 rounded-lg border border-stone-600 text-stone-400 text-sm hover:bg-stone-800 transition-colors"
          >
            No
          </button>
        </div>
        <p className="text-stone-600 text-xs mt-2 text-center">
          Auto-dismisses in {remaining}s
        </p>
      </div>
    </div>
  );
}
