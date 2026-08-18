/**
 * Numpad speed-control key mapping.
 *
 * Matching is on `event.code`, never `event.key`: with NumLock on,
 * Shift+Numpad1 reports `key: "End"` while `code` stays "Numpad1".
 * `Digit0`-`Digit9` are accepted as a fallback for keyboards without a numpad.
 */

const NUMPAD_CODE = /^Numpad([0-9])$/;
const DIGIT_CODE = /^Digit([0-9])$/;

/** Digit 1-9 maps to a 10%-90% change; 0 restores original speed. */
export function speedControlDigit(code: string): number | null {
  const match = NUMPAD_CODE.exec(code) ?? DIGIT_CODE.exec(code);
  const digit = match?.[1];
  return digit === undefined ? null : Number(digit);
}

/**
 * Resolve a keypress to a playback speed factor.
 * Returns null when the key is not a speed-control key.
 */
export function speedFactorFromKey(code: string, shiftKey: boolean): number | null {
  const digit = speedControlDigit(code);
  if (digit === null) return null;
  if (digit === 0) return 1;

  const delta = digit / 10;
  // Binary fractions leave artefacts like 0.30000000000000004
  return Math.round((shiftKey ? 1 - delta : 1 + delta) * 100) / 100;
}

/** `e` arms edge mode — matched on `code` for the same reason as the digits. */
const EDGE_MODE_CODE = 'KeyE';

/** True when the keypress should start the edge program. */
export function isEdgeModeKey(code: string): boolean {
  return code === EDGE_MODE_CODE;
}

/** Render a factor as a badge label, e.g. "×1.4 (+40%)". */
export function formatSpeedFactor(factor: number): string {
  const percent = Math.round((factor - 1) * 100);
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  return `×${factor.toFixed(2).replace(/\.?0+$/, '')} (${sign}${Math.abs(percent)}%)`;
}
