/**
 * Maps the 0-9 keys — the row above the letters and the numpad — to a rank.
 * Uses KeyboardEvent.code so the numpad works whether or not Num Lock is on.
 */

const RANK_KEY_CODE = /^(?:Digit|Numpad)([0-9])$/;

export function rankFromKeyCode(code: string): number | null {
  const match = RANK_KEY_CODE.exec(code);
  return match ? Number(match[1]) : null;
}
