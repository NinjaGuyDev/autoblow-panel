/**
 * Keyboard live speed control for Script Library playback.
 *
 * Numpad digits set a speed factor: the badge updates on every keypress, but
 * the device upload is debounced, because each hot-swap costs a round trip and
 * rapid presses should coalesce into one.
 *
 * `e` starts the edge program. That one is not debounced — it is a single
 * deliberate press, and it anchors to the playhead at the moment it fires.
 */

import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { isTypingInInput } from '@/lib/keyboardUtils';
import { isEdgeModeKey, speedFactorFromKey } from '@/lib/speedControlKeys';

const UPLOAD_DEBOUNCE_MS = 300;

interface UseSpeedControlParams {
  /** Only listen while a script is actually playing. */
  enabled: boolean;
  /** Fired immediately so the UI can reflect the pending factor. */
  onFactorPreview: (factor: number) => void;
  /** Fired after the debounce window — this is the one that hits the device. */
  onFactorCommit: (factor: number) => void;
  /** Fired on `e`, undebounced, to start the edge program. */
  onEdgeMode: () => void;
}

export function useSpeedControl({
  enabled,
  onFactorPreview,
  onFactorCommit,
  onEdgeMode,
}: UseSpeedControlParams): void {
  const commitFactor = useDebouncedCallback(onFactorCommit, UPLOAD_DEBOUNCE_MS);

  useEffect(() => {
    if (!enabled) {
      commitFactor.cancel();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingInInput(event)) return;

      if (isEdgeModeKey(event.code)) {
        event.preventDefault();
        // A pending factor would land after the edge upload and undo it
        commitFactor.cancel();
        onEdgeMode();
        return;
      }

      const factor = speedFactorFromKey(event.code, event.shiftKey);
      if (factor === null) return;

      event.preventDefault();
      onFactorPreview(factor);
      commitFactor(factor);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      commitFactor.cancel();
    };
  }, [enabled, commitFactor, onFactorPreview, onEdgeMode]);
}
