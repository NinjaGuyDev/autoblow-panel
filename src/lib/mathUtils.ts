/**
 * Shared math utilities for pattern generation, interpolation, and position clamping
 */

/**
 * Linear interpolation between two values, rounded to nearest integer
 * @param start - Starting value
 * @param end - Ending value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value rounded to nearest integer
 */
export function lerp(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

/**
 * Clamp a position value to the valid 0-100 range
 * @param pos - Position value to clamp
 * @returns Clamped position between 0 and 100
 */
export function clampPos(pos: number): number {
  return Math.max(0, Math.min(100, pos));
}

/**
 * Generate a random 32-bit unsigned integer for use as a script ID
 * @returns Random integer in range [0, 0xFFFFFFFF)
 */
export function generateScriptId(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF);
}
