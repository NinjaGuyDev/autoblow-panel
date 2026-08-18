/**
 * Deterministic pseudo-random number generator.
 * Mod compilation takes an injectable RNG so a mod can be replayed exactly
 * in tests while still being re-rolled with a fresh seed at runtime.
 */

/** Returns floats in [0, 1). */
export type RandomSource = () => number;

/** mulberry32 — small, fast, and stable across runs for a given seed. */
export function createSeededRng(seed: number): RandomSource {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed derived from wall-clock time plus entropy, for non-reproducible rolls. */
export function createRandomSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) | 0;
}
