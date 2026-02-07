/**
 * Pattern generators for manual device control
 * Pure functions that compute position values (0-100) from time-based inputs
 */

export type PatternGenerator = (
  elapsed: number,    // ms since pattern started
  speed: number,      // 0-100 (controls frequency/period)
  minY: number,       // 0-100 (minimum position)
  maxY: number,       // 0-100 (maximum position)
  increment: number,  // 1-50 (step size - affects granularity of position changes)
  variability: number // 0-100 (randomness injection)
) => number;

/**
 * Compute period from speed parameter
 * speed=1 gives ~4s period, speed=100 gives ~200ms period
 */
function getPeriodFromSpeed(speed: number): number {
  return 4000 - (speed / 100) * 3800;
}

/**
 * Quantize position to nearest increment step
 */
function quantizeToIncrement(position: number, increment: number): number {
  return Math.round(position / increment) * increment;
}

/**
 * Apply variability (randomness) to position
 */
function applyVariability(
  position: number,
  variability: number,
  amplitude: number,
  minY: number,
  maxY: number
): number {
  const noise = (Math.random() - 0.5) * (variability / 100) * amplitude * 0.5;
  const result = position + noise;
  return Math.max(minY, Math.min(maxY, result));
}

/**
 * Generate sine wave oscillation between minY and maxY
 */
export function generateSineWave(
  elapsed: number,
  speed: number,
  minY: number,
  maxY: number,
  increment: number,
  variability: number
): number {
  const period = getPeriodFromSpeed(speed);
  const center = (minY + maxY) / 2;
  const amplitude = (maxY - minY) / 2;

  // Base sine wave
  const basePosition = center + amplitude * Math.sin(2 * Math.PI * elapsed / period);

  // Apply increment quantization
  const quantized = quantizeToIncrement(basePosition, increment);

  // Apply variability
  return applyVariability(quantized, variability, amplitude, minY, maxY);
}

/**
 * Generate triangle wave (linear ramp up then down) between minY and maxY
 */
export function generateTriangleWave(
  elapsed: number,
  speed: number,
  minY: number,
  maxY: number,
  increment: number,
  variability: number
): number {
  const period = getPeriodFromSpeed(speed);
  const amplitude = (maxY - minY) / 2;
  const t = (elapsed % period) / period; // 0 to 1

  // Triangle wave: ramp up first half, ramp down second half
  const basePosition = t < 0.5
    ? minY + (maxY - minY) * (t * 2)
    : maxY - (maxY - minY) * ((t - 0.5) * 2);

  // Apply increment quantization
  const quantized = quantizeToIncrement(basePosition, increment);

  // Apply variability
  return applyVariability(quantized, variability, amplitude, minY, maxY);
}

/**
 * State for random walk generator
 */
interface RandomWalkState {
  currentPosition: number;
  targetPosition: number;
  lastUpdateTime: number;
}

/**
 * Create a random walk generator with internal state
 * Returns a PatternGenerator function that maintains smooth random motion
 */
export function createRandomWalkGenerator(): PatternGenerator {
  // Closure state
  const state: RandomWalkState = {
    currentPosition: 50, // Will be initialized on first call
    targetPosition: 50,
    lastUpdateTime: 0,
  };

  let initialized = false;

  return (
    elapsed: number,
    speed: number,
    minY: number,
    maxY: number,
    increment: number,
    variability: number
  ): number => {
    // Initialize position to center on first call
    if (!initialized) {
      state.currentPosition = (minY + maxY) / 2;
      state.targetPosition = state.currentPosition;
      state.lastUpdateTime = elapsed;
      initialized = true;
    }

    // Compute update interval from speed
    // speed=100 gives ~100ms, speed=1 gives ~2s
    const interval = 2000 - (speed / 100) * 1900;

    // Check if we need to pick a new target
    const timeSinceLastUpdate = elapsed - state.lastUpdateTime;
    if (timeSinceLastUpdate >= interval) {
      // Pick new target
      const range = maxY - minY;
      const maxStep = increment * 5; // Increment controls max step size

      // Variability controls randomness vs. centering
      // variability=0: tend toward center
      // variability=100: fully random within constraints
      const center = (minY + maxY) / 2;
      const randomTarget = minY + Math.random() * range;
      const centeredTarget = center;

      // Blend between centered and random based on variability
      const blendedTarget = centeredTarget + (randomTarget - centeredTarget) * (variability / 100);

      // Constrain target to be within maxStep of current position
      const maxTarget = Math.min(maxY, state.currentPosition + maxStep);
      const minTarget = Math.max(minY, state.currentPosition - maxStep);
      state.targetPosition = Math.max(minTarget, Math.min(maxTarget, blendedTarget));

      state.lastUpdateTime = elapsed;
    }

    // Smoothly interpolate toward target using smoothstep easing
    const t = Math.min(1, timeSinceLastUpdate / interval);
    const eased = t * t * (3 - 2 * t); // smoothstep
    const position = state.currentPosition + (state.targetPosition - state.currentPosition) * eased;

    // Update current position for next frame
    state.currentPosition = position;

    // Clamp to range
    return Math.max(minY, Math.min(maxY, position));
  };
}
