/**
 * Turns whole source scripts into a set of distinct ~10 second trainer
 * patterns: tile each script into sample windows, group windows that move the
 * same way, then keep a few noticeably different variations of each group.
 */

import { TRAINER_MAX_SPEED, type FunscriptActionDto, type NewTrainerPattern } from '../../types/shared.js';
import { tileSampleWindows, type SampleWindow, type WindowRules } from './sample-windows.js';
import { describeActions, featureDistance, type FeatureRules, type PatternFeatures } from './pattern-features.js';
import { clusterByAverageLinkage, medoid, pickVariations } from './clustering.js';
import { describePattern, familyLetter, intensityOf, tagsOf } from './pattern-naming.js';

export interface ExtractionOptions extends WindowRules, FeatureRules {
  /** Samples closer than this (feature distance) belong to the same pattern. */
  familyDistance: number;
  /** Variations of one pattern must be at least this far apart. */
  variationMinDistance: number;
  maxVariationsPerFamily: number;
}

export const DEFAULT_EXTRACTION_OPTIONS: Readonly<ExtractionOptions> = {
  targetDurationMs: 10_000,
  minDurationMs: 8_000,
  maxDurationMs: 12_000,
  maxSpeed: TRAINER_MAX_SPEED,
  maxStillMs: 3_000,
  stillSpeed: 5,
  minReversals: 3,
  turnAmplitude: 10,
  familyDistance: 2.0,
  variationMinDistance: 0.6,
  maxVariationsPerFamily: 4,
};

export interface SourceScript {
  label: string;
  actions: FunscriptActionDto[];
}

interface DescribedSample {
  window: SampleWindow;
  features: PatternFeatures;
}

const sampleDistance = (a: DescribedSample, b: DescribedSample): number => featureDistance(a.features, b.features);

function toTrainerPattern(sample: DescribedSample, familyKey: string, familyName: string, variation: number): NewTrainerPattern {
  const { window, features } = sample;
  return {
    patternKey: `${window.sourceLabel}@${window.startMs}`,
    name: `${familyName} ${familyKey}${variation}`,
    sourceLabel: window.sourceLabel,
    familyKey,
    variation,
    actions: window.actions,
    durationMs: window.actions[window.actions.length - 1]!.at,
    intensity: intensityOf(features),
    tags: tagsOf(features),
  };
}

export function extractTrainerPatterns(
  sources: SourceScript[],
  options: ExtractionOptions = DEFAULT_EXTRACTION_OPTIONS,
): NewTrainerPattern[] {
  const samples: DescribedSample[] = sources
    .flatMap(source => tileSampleWindows(source.label, source.actions, options))
    .map(window => ({ window, features: describeActions(window.actions, options) }));

  // Most common patterns first, so family A is the one the sources lean on most
  const families = clusterByAverageLinkage(samples, sampleDistance, options.familyDistance)
    .sort((a, b) => b.length - a.length);

  return families.flatMap((members, index) => {
    const familyKey = familyLetter(index);
    const familyName = describePattern(medoid(members, sampleDistance).features);
    return pickVariations(members, sampleDistance, options.variationMinDistance, options.maxVariationsPerFamily)
      .map((sample, i) => toTrainerPattern(sample, familyKey, familyName, i + 1));
  });
}
