import { describe, it, expect } from 'vitest';
import { easingFunctions, type EasingFunction, type InterpolationType } from '../easing';

describe('easing functions', () => {
  describe('linear', () => {
    it('should return input value unchanged', () => {
      expect(easingFunctions.linear(0)).toBe(0);
      expect(easingFunctions.linear(0.5)).toBe(0.5);
      expect(easingFunctions.linear(1)).toBe(1);
    });
  });

  describe('easeIn', () => {
    it('should start slow and accelerate', () => {
      expect(easingFunctions.easeIn(0)).toBe(0);
      expect(easingFunctions.easeIn(1)).toBe(1);
      // At midpoint, cubic easeIn should be slower than linear
      expect(easingFunctions.easeIn(0.5)).toBeLessThan(0.5);
    });
  });

  describe('easeOut', () => {
    it('should start fast and decelerate', () => {
      expect(easingFunctions.easeOut(0)).toBe(0);
      expect(easingFunctions.easeOut(1)).toBe(1);
      // At midpoint, cubic easeOut should be faster than linear
      expect(easingFunctions.easeOut(0.5)).toBeGreaterThan(0.5);
    });
  });

  describe('easeInOut', () => {
    it('should accelerate then decelerate symmetrically', () => {
      expect(easingFunctions.easeInOut(0)).toBe(0);
      expect(easingFunctions.easeInOut(1)).toBe(1);
      // At midpoint, should be at midpoint (symmetric)
      expect(easingFunctions.easeInOut(0.5)).toBe(0.5);
    });
  });

  describe('step', () => {
    it('should always return 0 (special case handled in generator)', () => {
      expect(easingFunctions.step(0)).toBe(0);
      expect(easingFunctions.step(0.25)).toBe(0);
      expect(easingFunctions.step(0.5)).toBe(0);
      expect(easingFunctions.step(0.75)).toBe(0);
      expect(easingFunctions.step(1)).toBe(0);
    });
  });

  describe('boundary conditions', () => {
    it('should return values in [0,1] for inputs in [0,1]', () => {
      const testValues = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
      const easingTypes: InterpolationType[] = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'step'];

      for (const type of easingTypes) {
        const fn = easingFunctions[type];
        for (const t of testValues) {
          const result = fn(t);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
