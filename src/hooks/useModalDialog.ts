/**
 * Modal dialog behaviour for an overlay component.
 *
 * Gives an overlay the parts that make it a real dialog rather than a floating
 * panel: focus moves into it on open, Tab stays inside it, Escape closes it,
 * and focus returns to whatever the user was on when it closes. Pair the
 * returned ref with `role="dialog"`, `aria-modal="true"` and an accessible name
 * on the dialog element.
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(element => element.offsetParent !== null || element === document.activeElement);
}

/**
 * @param onClose called on Escape; may be a new function on every render.
 * @returns ref to attach to the dialog element.
 */
export function useModalDialog<T extends HTMLElement>(onClose: () => void) {
  const containerRef = useRef<T>(null);

  // Kept in a ref so an inline arrow prop does not re-arm the listener, which
  // would re-run the initial-focus effect on every render
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    (focusableElements(container)[0] ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = focusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it escaped the dialog
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus();
    };
  }, []);

  return containerRef;
}
