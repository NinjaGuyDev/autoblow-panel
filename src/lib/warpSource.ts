/**
 * What the active time warp is derived from.
 *
 * Exactly one source is active at a time, which is what makes a numpad speed
 * factor, a saved mod and edge mode mutually exclusive. Edge mode is the one
 * source that remembers what it displaced: a mod is *suspended* for the length
 * of the program and handed back when it ends.
 *
 * These are pure transitions — the hook owns the device I/O, this module owns
 * the rules about which source wins.
 */

import type { ScriptMod } from '@server/types/shared';

export type WarpSource =
  | { kind: 'factor'; factor: number }
  | { kind: 'mod'; mod: ScriptMod }
  | { kind: 'edge'; startOriginalMs: number; suspendedMod: ScriptMod | null };

/** Unmodified playback. */
export const NO_WARP: WarpSource = { kind: 'factor', factor: 1 };

/**
 * Arm edge mode at `startOriginalMs`, suspending any active mod.
 * Re-arming while edge mode is already running keeps whatever it suspended, so
 * a second press does not lose the mod waiting behind it.
 */
export function startEdge(source: WarpSource, startOriginalMs: number): WarpSource {
  return { kind: 'edge', startOriginalMs, suspendedMod: suspendedMod(source) };
}

/**
 * The source to return to once an edge program ends: the suspended mod if there
 * was one, otherwise unmodified playback. Non-edge sources are left alone.
 */
export function resumeAfterEdge(source: WarpSource): WarpSource {
  if (source.kind !== 'edge') return source;
  return source.suspendedMod ? { kind: 'mod', mod: source.suspendedMod } : NO_WARP;
}

/** The mod a source is holding — active for `mod`, waiting for `edge`. */
export function suspendedMod(source: WarpSource): ScriptMod | null {
  if (source.kind === 'mod') return source.mod;
  if (source.kind === 'edge') return source.suspendedMod;
  return null;
}

/** The mod currently shaping playback, which is none while edge mode runs. */
export function activeMod(source: WarpSource): ScriptMod | null {
  return source.kind === 'mod' ? source.mod : null;
}
