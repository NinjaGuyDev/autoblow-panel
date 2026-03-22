import type { FunscriptAction } from '@/types/funscript';

/**
 * Options controlling the humanization algorithm
 */
export interface HumanizerOptions {
  /** Max position variation applied to peaks/valleys, in pos units (0–20) */
  amplitudeVariance: number;
  /** Max timing shift as a fraction of the stroke interval (0–0.3 = 0–30%) */
  timingVariance: number;
  /** Minimum consecutive similar strokes required to trigger humanization */
  minRepetitions: number;
  /**
   * Tolerance for classifying two strokes as "similar":
   * fraction of mean stroke range/interval that the current stroke may differ
   * (0.4 = within 40% of the mean — generous, since scripts vary naturally)
   */
  similarityTolerance: number;
}

export const DEFAULT_HUMANIZER_OPTIONS: HumanizerOptions = {
  amplitudeVariance: 8,
  timingVariance: 0.12,
  minRepetitions: 3,
  similarityTolerance: 0.4,
};

// ---------------------------------------------------------------------------
// Minimal seeded PRNG (mulberry32) — deterministic but different each apply
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a random float in [-1, 1] */
function randomSigned(rand: () => number): number {
  return rand() * 2 - 1;
}

// ---------------------------------------------------------------------------
// Stroke detection
// ---------------------------------------------------------------------------

interface Stroke {
  /** Index of the turning point (peak/valley) at the END of this stroke */
  apexIndex: number;
  /** Absolute position change for this stroke */
  range: number;
  /** Duration of this stroke in ms */
  intervalMs: number;
}

/**
 * Identifies strokes (transitions between direction reversals).
 * A stroke ends at each turning point (local min or max).
 */
function detectStrokes(actions: FunscriptAction[]): Stroke[] {
  if (actions.length < 3) return [];

  const strokes: Stroke[] = [];

  for (let i = 1; i < actions.length - 1; i++) {
    const prevDelta = actions[i]!.pos - actions[i - 1]!.pos;
    const nextDelta = actions[i + 1]!.pos - actions[i]!.pos;

    // Turning point: direction reversal
    if (prevDelta * nextDelta < 0) {
      const intervalMs = actions[i]!.at - actions[i - 1]!.at;
      strokes.push({
        apexIndex: i,
        range: Math.abs(prevDelta),
        intervalMs,
      });
    }
  }

  return strokes;
}

// ---------------------------------------------------------------------------
// Repetition detection
// ---------------------------------------------------------------------------

interface RepetitiveRun {
  /** Stroke indices (into the strokes array) that form this run */
  strokeIndices: number[];
}

/**
 * Finds runs of consecutive strokes that are similar in range and timing.
 */
function detectRepetitiveRuns(
  strokes: Stroke[],
  minRepetitions: number,
  similarityTolerance: number
): RepetitiveRun[] {
  if (strokes.length < minRepetitions) return [];

  const runs: RepetitiveRun[] = [];
  let runStart = 0;

  while (runStart < strokes.length) {
    // Compute mean range and interval for the window starting at runStart
    // (use up to 6 strokes as the reference window)
    const windowSize = Math.min(6, strokes.length - runStart);
    if (windowSize < minRepetitions) break;

    const windowStrokes = strokes.slice(runStart, runStart + windowSize);
    const meanRange = windowStrokes.reduce((s, st: Stroke) => s + st.range, 0) / windowSize;
    const meanInterval = windowStrokes.reduce((s, st: Stroke) => s + st.intervalMs, 0) / windowSize;

    if (meanRange === 0 || meanInterval === 0) {
      runStart++;
      continue;
    }

    // Extend run as long as strokes stay within tolerance
    const currentRun: number[] = [];
    let i = runStart;

    while (i < strokes.length) {
      const st = strokes[i]!;
      const rangeDiff = Math.abs(st.range - meanRange) / meanRange;
      const intervalDiff = Math.abs(st.intervalMs - meanInterval) / meanInterval;

      if (rangeDiff <= similarityTolerance && intervalDiff <= similarityTolerance) {
        currentRun.push(i);
        i++;
      } else {
        break;
      }
    }

    if (currentRun.length >= minRepetitions) {
      runs.push({ strokeIndices: currentRun });
      // Advance past this run
      runStart = i;
    } else {
      runStart++;
    }
  }

  return runs;
}

// ---------------------------------------------------------------------------
// Core transformation
// ---------------------------------------------------------------------------

/**
 * Apply position variance to a single apex, clamping to [0, 100].
 * Biases the shift outward (toward nearest extreme) to preserve feel.
 */
function perturbPosition(pos: number, maxVariance: number, rand: () => number): number {
  const shift = randomSigned(rand) * maxVariance;
  return Math.max(0, Math.min(100, Math.round(pos + shift)));
}

/**
 * Shift a timestamp by ±(timingVariance * nominalInterval) while preserving
 * a minimum gap of MIN_INTERVAL_MS on each side to avoid impossible speeds.
 */
const MIN_INTERVAL_MS = 50;

function perturbTiming(
  actions: FunscriptAction[],
  index: number,
  nominalIntervalMs: number,
  timingVariance: number,
  rand: () => number
): number {
  const maxShift = Math.floor(nominalIntervalMs * timingVariance);
  if (maxShift === 0) return actions[index]!.at;

  const rawShift = Math.round(randomSigned(rand) * maxShift);

  // Clamp so neither adjacent gap falls below MIN_INTERVAL_MS
  const prev = index > 0 ? actions[index - 1]!.at : actions[index]!.at - MIN_INTERVAL_MS;
  const next = index < actions.length - 1 ? actions[index + 1]!.at : actions[index]!.at + MIN_INTERVAL_MS;

  const minAt = prev + MIN_INTERVAL_MS;
  const maxAt = next - MIN_INTERVAL_MS;

  if (minAt > maxAt) return actions[index]!.at;

  return Math.max(minAt, Math.min(maxAt, actions[index]!.at + rawShift));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map intensity (0–100) to HumanizerOptions.
 * Low intensity = subtle organic variation; high = pronounced differences.
 */
export function intensityToHumanizerOptions(intensity: number): HumanizerOptions {
  const t = Math.max(0, Math.min(100, intensity)) / 100;

  return {
    amplitudeVariance: Math.round(2 + t * 18),   // 2 → 20
    timingVariance: 0.03 + t * 0.27,              // 3% → 30%
    minRepetitions: DEFAULT_HUMANIZER_OPTIONS.minRepetitions,
    similarityTolerance: DEFAULT_HUMANIZER_OPTIONS.similarityTolerance,
  };
}

/**
 * Humanize a funscript by introducing controlled randomness into repetitive
 * oscillation patterns. Similar consecutive strokes are given varied
 * amplitude and timing so the motion feels organic rather than mechanical.
 *
 * Never modifies the first or last action.
 *
 * @param actions  Source funscript actions (sorted by `at`)
 * @param options  Humanization parameters
 * @returns        New array with humanized actions
 */
export function humanizeFunscript(
  actions: FunscriptAction[],
  options: Partial<HumanizerOptions> = {}
): FunscriptAction[] {
  if (actions.length < 3) return [...actions];

  const opts: HumanizerOptions = {
    ...DEFAULT_HUMANIZER_OPTIONS,
    ...options,
  };

  // Fresh random seed each call → different result on every Apply
  const rand = mulberry32(Date.now() ^ (Math.random() * 0xffffffff));

  const strokes = detectStrokes(actions);
  if (strokes.length === 0) return [...actions];

  const runs = detectRepetitiveRuns(strokes, opts.minRepetitions, opts.similarityTolerance);
  if (runs.length === 0) return [...actions];

  // Collect apex indices that should be perturbed
  const perturbSet = new Set<number>();
  for (const run of runs) {
    for (const si of run.strokeIndices) {
      const apexIndex = strokes[si]!.apexIndex;
      // Never touch first or last action
      if (apexIndex > 0 && apexIndex < actions.length - 1) {
        perturbSet.add(apexIndex);
      }
    }
  }

  // Build result — deep copy first, then apply perturbations in place
  const result: FunscriptAction[] = actions.map(a => ({ ...a }));

  for (const idx of perturbSet) {
    // Find representative stroke interval for timing variance
    const stroke = strokes.find(s => s.apexIndex === idx);
    const nominalInterval = stroke ? stroke.intervalMs : 200;

    // Perturb position
    result[idx]!.pos = perturbPosition(result[idx]!.pos, opts.amplitudeVariance, rand);

    // Perturb timing (operates on result so adjacent perturbations interact)
    result[idx]!.at = perturbTiming(result, idx, nominalInterval, opts.timingVariance, rand);
  }

  // Ensure timestamps remain strictly increasing after timing perturbations
  for (let i = 1; i < result.length; i++) {
    if (result[i]!.at <= result[i - 1]!.at) {
      result[i]!.at = result[i - 1]!.at + MIN_INTERVAL_MS;
    }
  }

  return result;
}
