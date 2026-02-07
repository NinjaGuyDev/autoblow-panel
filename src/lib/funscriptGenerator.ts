import type { PatternType } from '@/types/device';
import type { Funscript } from '@xsense/autoblow-sdk';
import {
  generateSineWave,
  generateTriangleWave,
  createRandomWalkGenerator,
  type PatternGenerator,
} from './patternGenerators';

/**
 * Generate a funscript from pattern parameters
 * @param patternType Pattern type (sine-wave, triangle-wave, random-walk)
 * @param speed Speed parameter (0-100)
 * @param minY Minimum position (0-100)
 * @param maxY Maximum position (0-100)
 * @param increment Step size (1-50)
 * @param variability Randomness (0-100)
 * @param durationMs Duration of the funscript in milliseconds (default: 5 minutes)
 * @param sampleIntervalMs Interval between action points in ms (default: 100ms)
 * @returns Funscript object ready to upload to device
 */
export function generatePatternFunscript(
  patternType: PatternType,
  speed: number,
  minY: number,
  maxY: number,
  increment: number,
  variability: number,
  durationMs: number = 5 * 60 * 1000, // 5 minutes
  sampleIntervalMs: number = 100 // Sample every 100ms
): Funscript {
  // Select generator based on pattern type
  let generator: PatternGenerator;
  if (patternType === 'sine-wave') {
    generator = generateSineWave;
  } else if (patternType === 'triangle-wave') {
    generator = generateTriangleWave;
  } else if (patternType === 'random-walk') {
    generator = createRandomWalkGenerator();
  } else {
    throw new Error(`Cannot generate funscript for pattern type: ${patternType}`);
  }

  // Generate action points by sampling the pattern
  const actions: { at: number; pos: number }[] = [];
  for (let timestamp = 0; timestamp <= durationMs; timestamp += sampleIntervalMs) {
    const position = generator(
      timestamp,
      speed,
      minY,
      maxY,
      increment,
      variability
    );

    actions.push({
      at: timestamp,
      pos: Math.round(position), // Round to integer for cleaner data
    });
  }

  // Return SDK-compatible Funscript
  return {
    metadata: {
      id: Date.now(), // Use timestamp as unique ID
      version: 1,
    },
    actions,
  };
}
