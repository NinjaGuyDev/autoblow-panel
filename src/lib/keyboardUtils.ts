/**
 * Keyboard input guard utilities.
 * Prevents keyboard shortcuts from firing when the user is typing
 * in form fields (text inputs, textareas, selects, contentEditable).
 */

/** Input types where the user is actively entering text. */
const TEXT_INPUT_TYPES = new Set([
  'text', 'password', 'search', 'tel', 'url', 'email', 'number',
]);

/**
 * Returns true when the keyboard event target (or the currently focused element)
 * is a text-entry field where keyboard shortcuts should be suppressed.
 *
 * Non-text input controls (range, checkbox, radio, button, file, color, etc.)
 * are excluded — shortcuts should still work when those are focused.
 */
export function isTypingInInput(event: KeyboardEvent): boolean {
  const target = (event.target as HTMLElement | null) ?? document.activeElement;
  if (!target) return false;

  if (target.tagName === 'INPUT') {
    const inputType = (target as HTMLInputElement).type.toLowerCase();
    return TEXT_INPUT_TYPES.has(inputType);
  }

  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }

  return (target as HTMLElement).isContentEditable === true;
}
