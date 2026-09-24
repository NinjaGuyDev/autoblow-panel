/**
 * Listens for the 0-9 keys (top row and numpad) while `enabled`, reporting
 * each press as a rank. Ignored while typing in a text field or with a
 * modifier held, so browser shortcuts keep working.
 */

import { useEffect, useRef } from 'react';
import { rankFromKeyCode } from '@/lib/trainer/rankKeys';
import { isTypingInInput } from '@/lib/keyboardUtils';

export function useRankKeys(enabled: boolean, onRank: (rank: number) => void): void {
  const onRankRef = useRef(onRank);

  useEffect(() => {
    onRankRef.current = onRank;
  }, [onRank]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (isTypingInInput(event)) return;

      const rank = rankFromKeyCode(event.code);
      if (rank === null) return;

      event.preventDefault();
      onRankRef.current(rank);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
