/**
 * Human-readable names, intensity and style tags derived from pattern features.
 */

import type { TrainerIntensity } from '../../types/shared.js';
import type { PatternFeatures } from './pattern-features.js';

function tempoWord(features: PatternFeatures): string {
  if (features.halfStrokesPerSecond < 0.9) return 'Slow';
  if (features.halfStrokesPerSecond < 1.6) return 'Steady';
  return 'Quick';
}

function depthWord(features: PatternFeatures): string {
  if (features.meanAmplitude >= 65) return 'Full';
  if (features.meanAmplitude >= 40) return 'Long';
  if (features.meanAmplitude >= 20) return 'Short';
  return 'Flicker';
}

function zoneWord(features: PatternFeatures): string {
  if (features.meanPosition >= 65) return 'High';
  if (features.meanPosition <= 35) return 'Low';
  return 'Mid';
}

/** e.g. "Slow Long Strokes, High, with Pauses". */
export function describePattern(features: PatternFeatures): string {
  const pauses = features.stillFraction >= 0.1 ? ', with Pauses' : '';
  return `${tempoWord(features)} ${depthWord(features)} Strokes, ${zoneWord(features)}${pauses}`;
}

export function intensityOf(features: PatternFeatures): TrainerIntensity {
  if (features.averageSpeed < 35) return 'low';
  if (features.averageSpeed < 70) return 'medium';
  return 'high';
}

/** Tags drawn from the Patterns page vocabulary so cards read the same way. */
export function tagsOf(features: PatternFeatures): string[] {
  const tags: string[] = [];
  if (features.stillFraction >= 0.1) tags.push('pause');
  if (features.tempoVariation < 0.25) tags.push('rhythmic');
  if (features.tempoVariation > 0.5) tags.push('random');
  if (features.meanAmplitude >= 65) tags.push('surge');
  return tags;
}

/** Spreadsheet-style family letters: A..Z, then AA, AB, ... */
export function familyLetter(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}
