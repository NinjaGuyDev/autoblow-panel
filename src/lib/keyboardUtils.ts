/**
 * Keyboard input guard utilities.
 * Prevents keyboard shortcuts from firing when the user is typing
 * in form fields (text inputs, textareas, selects).
 */

/**
 * Returns true when the keyboard event target (or the currently focused element)
 * is a text-entry field where keyboard shortcuts should be suppressed.
 *
 * Range inputs (e.g. sliders / progress bars) are excluded — shortcuts
 * should still work when a range input is focused.
 */
export function isTypingInInput(event: KeyboardEvent): boolean {
  const target = (event.target as HTMLElement | null) ?? document.activeElement;
  if (!target) return false;

  if (target.tagName === 'INPUT') {
    const inputType = (target as HTMLInputElement).type;
    // Allow shortcuts when a range input (slider) is focused
    return inputType !== 'range';
  }

  return target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
