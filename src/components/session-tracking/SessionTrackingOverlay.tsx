import { useState, useEffect } from 'react';

interface SessionTrackingOverlayProps {
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * SessionTrackingOverlay component
 * Non-blocking toast overlay for session tracking opt-in
 *
 * Behavior:
 * - Appears in bottom-right corner as non-blocking toast
 * - Auto-dismisses after 5 seconds (defaults to decline)
 * - User can explicitly accept or decline tracking
 */
export function SessionTrackingOverlay({ onAccept, onDecline }: SessionTrackingOverlayProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 5 seconds (calls onDecline)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(false);
      onDecline();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [onDecline]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-stone-900 border border-stone-700 rounded-lg p-4 shadow-2xl">
        <p className="text-stone-200 text-sm mb-3">
          Track this session for usage analytics?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setVisible(false);
              onAccept();
            }}
            className="flex-1 px-3 py-1.5 rounded bg-amber-700 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Yes, track it
          </button>
          <button
            onClick={() => {
              setVisible(false);
              onDecline();
            }}
            className="px-3 py-1.5 rounded border border-stone-600 text-stone-400 text-sm hover:bg-stone-800 transition-colors"
          >
            No thanks
          </button>
        </div>
        <p className="text-stone-500 text-xs mt-2">Auto-dismisses in 5s (defaults to not tracking)</p>
      </div>
    </div>
  );
}
