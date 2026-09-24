/**
 * Chooses which trainer pattern plays next: never the one that just played,
 * and weighted towards patterns that have been ranked the fewest times.
 */

export interface RankablePattern {
  id: number;
  rankCount: number;
}

/** A pattern ranked n times is 1/(n+1)² as likely to come up as an unranked one. */
export function selectionWeight(rankCount: number): number {
  return 1 / (1 + rankCount) ** 2;
}

/**
 * @param random returns a value in [0, 1) — injectable for deterministic tests
 * @returns the chosen pattern, or null when there is nothing to choose from
 */
export function pickNextPattern<T extends RankablePattern>(
  patterns: readonly T[],
  previousId: number | null,
  random: () => number = Math.random,
): T | null {
  const candidates = patterns.length > 1 ? patterns.filter(p => p.id !== previousId) : patterns;
  if (candidates.length === 0) return null;

  const weights = candidates.map(p => selectionWeight(p.rankCount));
  let remaining = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < candidates.length; i++) {
    remaining -= weights[i]!;
    if (remaining < 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}
