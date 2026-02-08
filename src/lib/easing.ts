import type { InterpolationType } from '@/types/patterns';

/**
 * Easing function type - maps normalized time [0,1] to eased progress [0,1]
 */
export type EasingFunction = (t: number) => number;

/**
 * Easing functions for interpolation between waypoints
 * All functions map t ∈ [0,1] to output ∈ [0,1]
 */
export const easingFunctions: Record<InterpolationType, EasingFunction> = {
  /**
   * Linear interpolation - constant speed
   */
  linear: (t: number): number => t,

  /**
   * Cubic ease-in - slow start, accelerating
   */
  easeIn: (t: number): number => t * t * t,

  /**
   * Cubic ease-out - fast start, decelerating
   */
  easeOut: (t: number): number => {
    const u = t - 1;
    return u * u * u + 1;
  },

  /**
   * Cubic ease-in-out - slow start and end, fast middle
   */
  easeInOut: (t: number): number => {
    if (t < 0.5) {
      return 4 * t * t * t;
    } else {
      const u = t - 1;
      return 1 + 4 * u * u * u;
    }
  },

  /**
   * Step function - returns 0 (special case handled in generator)
   * Generator emits only start point for step segments
   */
  step: (_t: number): number => 0,
};

// Re-export InterpolationType for convenience
export type { InterpolationType };
