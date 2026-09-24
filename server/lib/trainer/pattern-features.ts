/**
 * Numeric description of a sample's motion, used to tell distinct patterns
 * apart and to name them.
 */

import type { FunscriptActionDto } from '../../types/shared.js';
import { segmentSpeed } from './sample-windows.js';

export interface PatternFeatures {
  /** Direction changes per second. */
  halfStrokesPerSecond: number;
  /** Mean travel between turning points, in position units. */
  meanAmplitude: number;
  /** Time-weighted mean position (0-100). */
  meanPosition: number;
  /** Total travel per second, in position units. */
  averageSpeed: number;
  /** Share of the sample (0-1) spent without motion. */
  stillFraction: number;
  /** Coefficient of variation of half-stroke durations — 0 is metronomic. */
  tempoVariation: number;
}

export interface FeatureRules {
  /** Segments slower than this (units per second) count as no motion. */
  stillSpeed: number;
  /** Smallest travel that counts as a stroke rather than a wiggle. */
  turnAmplitude: number;
}

/**
 * How far apart two samples must be on each feature to count as one unit of
 * difference. Tuned so a distance under ~1 reads as "the same pattern, slightly varied".
 */
const FEATURE_SCALES: Readonly<PatternFeatures> = {
  halfStrokesPerSecond: 0.35,
  meanAmplitude: 15,
  meanPosition: 12,
  averageSpeed: 12,
  stillFraction: 0.15,
  tempoVariation: 0.3,
};

/**
 * Turning points with wiggles smaller than `turnAmplitude` filtered out:
 * a candidate extreme is confirmed only once the motion retraces that far.
 */
export function turningPoints(actions: FunscriptActionDto[], turnAmplitude: number): FunscriptActionDto[] {
  if (actions.length === 0) return [];

  const points: FunscriptActionDto[] = [actions[0]!];
  let candidate = actions[0]!;
  let direction = 0;

  for (const action of actions.slice(1)) {
    const travel = action.pos - candidate.pos;
    const extendsCandidate = direction === 0 ? Math.abs(travel) >= turnAmplitude : Math.sign(travel) === direction;

    if (extendsCandidate) {
      if (direction === 0) direction = Math.sign(travel);
      candidate = action;
    } else if (Math.abs(travel) >= turnAmplitude) {
      points.push(candidate);
      direction = Math.sign(travel);
      candidate = action;
    }
  }
  points.push(candidate);
  return points;
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function coefficientOfVariation(values: number[]): number {
  const average = mean(values);
  if (average === 0) return 0;
  const variance = mean(values.map(v => (v - average) ** 2));
  return Math.sqrt(variance) / average;
}

function timeWeightedMeanPosition(actions: FunscriptActionDto[], durationMs: number): number {
  if (durationMs <= 0) return actions[0]?.pos ?? 0;
  let area = 0;
  for (let i = 1; i < actions.length; i++) {
    const [from, to] = [actions[i - 1]!, actions[i]!];
    area += ((from.pos + to.pos) / 2) * (to.at - from.at);
  }
  return area / durationMs;
}

function stillDurationMs(actions: FunscriptActionDto[], stillSpeed: number): number {
  let still = 0;
  for (let i = 1; i < actions.length; i++) {
    if (segmentSpeed(actions[i - 1]!, actions[i]!) < stillSpeed) {
      still += actions[i]!.at - actions[i - 1]!.at;
    }
  }
  return still;
}

function totalTravel(actions: FunscriptActionDto[]): number {
  let travel = 0;
  for (let i = 1; i < actions.length; i++) {
    travel += Math.abs(actions[i]!.pos - actions[i - 1]!.pos);
  }
  return travel;
}

export function describeActions(actions: FunscriptActionDto[], rules: FeatureRules): PatternFeatures {
  const durationMs = actions.length > 1 ? actions[actions.length - 1]!.at - actions[0]!.at : 0;
  const seconds = durationMs / 1000;
  const turns = turningPoints(actions, rules.turnAmplitude);
  const halfStrokes = turns.slice(1).map((point, i) => ({
    amplitude: Math.abs(point.pos - turns[i]!.pos),
    durationMs: point.at - turns[i]!.at,
  }));

  return {
    halfStrokesPerSecond: seconds > 0 ? halfStrokes.length / seconds : 0,
    meanAmplitude: mean(halfStrokes.map(h => h.amplitude)),
    meanPosition: timeWeightedMeanPosition(actions, durationMs),
    averageSpeed: seconds > 0 ? totalTravel(actions) / seconds : 0,
    stillFraction: durationMs > 0 ? stillDurationMs(actions, rules.stillSpeed) / durationMs : 0,
    tempoVariation: coefficientOfVariation(halfStrokes.map(h => h.durationMs)),
  };
}

/** Scaled Euclidean distance between two feature sets. */
export function featureDistance(a: PatternFeatures, b: PatternFeatures): number {
  let sum = 0;
  for (const key of Object.keys(FEATURE_SCALES) as Array<keyof PatternFeatures>) {
    sum += ((a[key] - b[key]) / FEATURE_SCALES[key]) ** 2;
  }
  return Math.sqrt(sum);
}
