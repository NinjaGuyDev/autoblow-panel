/**
 * Generic grouping helpers for turning many similar samples into a few
 * distinct patterns, each with a handful of variations.
 */

export type Distance<T> = (a: T, b: T) => number;

function averageLinkage<T>(a: T[], b: T[], distance: Distance<T>): number {
  let sum = 0;
  for (const x of a) for (const y of b) sum += distance(x, y);
  return sum / (a.length * b.length);
}

/**
 * Agglomerative clustering with average linkage: repeatedly merge the two
 * closest clusters until no pair is within `maxDistance`.
 */
export function clusterByAverageLinkage<T>(items: T[], distance: Distance<T>, maxDistance: number): T[][] {
  const clusters = items.map(item => [item]);

  for (;;) {
    let closest: { i: number; j: number; d: number } | null = null;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = averageLinkage(clusters[i]!, clusters[j]!, distance);
        if (d <= maxDistance && (!closest || d < closest.d)) closest = { i, j, d };
      }
    }
    if (!closest) return clusters;

    clusters[closest.i] = [...clusters[closest.i]!, ...clusters[closest.j]!];
    clusters.splice(closest.j, 1);
  }
}

/** The member with the smallest total distance to all others. */
export function medoid<T>(members: T[], distance: Distance<T>): T {
  let best: T = members[0]!;
  let bestTotal = Infinity;
  for (const candidate of members) {
    const total = members.reduce((sum, other) => sum + distance(candidate, other), 0);
    if (total < bestTotal) {
      best = candidate;
      bestTotal = total;
    }
  }
  return best;
}

/**
 * The medoid plus up to `max - 1` further members chosen farthest-first, each
 * at least `minDistance` from every member already chosen — so variations are
 * noticeably different without leaving the pattern.
 */
export function pickVariations<T>(members: T[], distance: Distance<T>, minDistance: number, max: number): T[] {
  if (members.length === 0) return [];

  const chosen = [medoid(members, distance)];
  while (chosen.length < max) {
    let next: T | null = null;
    let nextGap = minDistance;
    for (const candidate of members) {
      const gap = Math.min(...chosen.map(c => distance(candidate, c)));
      if (gap > 0 && gap >= nextGap) {
        next = candidate;
        nextGap = gap;
      }
    }
    if (next === null) break;
    chosen.push(next);
  }
  return chosen;
}
