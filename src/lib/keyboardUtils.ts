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

/** Tags whose native behaviour activates them on Space. */
const SPACE_ACTIVATED_TAGS = new Set(['BUTTON', 'A', 'SUMMARY']);

/** Input types the browser toggles or submits on Space. */
const SPACE_ACTIVATED_INPUT_TYPES = new Set([
  'button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'color', 'image',
]);

/** ARIA roles that take Space as their activation key. */
const SPACE_ACTIVATED_ROLES = new Set([
  'button', 'checkbox', 'switch', 'tab', 'menuitem', 'option', 'radio', 'link',
]);

/**
 * Returns true when Space on the event target already does something —
 * pressing a focused button, ticking a checkbox — so a global Space shortcut
 * must stand aside or it would fire on top of that action.
 */
export function isSpaceActivatedControl(event: KeyboardEvent): boolean {
  const target = (event.target as HTMLElement | null) ?? document.activeElement;
  if (!target) return false;

  if (SPACE_ACTIVATED_TAGS.has(target.tagName)) return true;

  if (target.tagName === 'INPUT') {
    return SPACE_ACTIVATED_INPUT_TYPES.has((target as HTMLInputElement).type.toLowerCase());
  }

  const role = target.getAttribute?.('role');
  return role !== null && role !== undefined && SPACE_ACTIVATED_ROLES.has(role);
}
