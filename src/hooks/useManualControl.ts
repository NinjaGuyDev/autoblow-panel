import { useState, useRef, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { PatternType, ManualControlParams } from '@/types/device';
import {
  generateSineWave,
  generateTriangleWave,
  createRandomWalkGenerator,
  type PatternGenerator,
} from '@/lib/patternGenerators';

export interface UseManualControlReturn {
  isRunning: boolean;
  patternType: PatternType;
  speed: number;
  minY: number;
  maxY: number;
  increment: number;
  variability: number;
  start: () => void;
  stop: () => void;
  updateParams: (params: Partial<ManualControlParams>) => void;
  setPatternType: (type: PatternType) => void;
  error: string | null;
}

/**
 * Hook to manage manual device control with multiple pattern types
 * Supports SDK oscillation and custom RAF-based patterns
 */
export function useManualControl(ultra: Ultra | null): UseManualControlReturn {
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [patternType, setPatternTypeState] = useState<PatternType>('oscillation');
  const [speed, setSpeed] = useState(50);
  const [minY, setMinY] = useState(10);
  const [maxY, setMaxY] = useState(90);
  const [increment, setIncrement] = useState(5);
  const [variability, setVariability] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for RAF loop
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const paramsRef = useRef({ speed, minY, maxY, increment, variability });
  const randomWalkGeneratorRef = useRef<PatternGenerator>(createRandomWalkGenerator());

  // Keep paramsRef in sync with state
  useEffect(() => {
    paramsRef.current = { speed, minY, maxY, increment, variability };
  }, [speed, minY, maxY, increment, variability]);

  // Debounced SDK oscillateSet for real-time parameter updates
  const debouncedOscillateSet = useDebouncedCallback(
    async (speed: number, minY: number, maxY: number) => {
      if (!ultra) return;
      try {
        await ultra.oscillateSet(speed, minY, maxY);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update oscillation parameters');
      }
    },
    150
  );

  /**
   * RAF loop callback for custom patterns
   */
  const rafCallback = useCallback((timestamp: number) => {
    if (!ultra) {
      stop();
      return;
    }

    const elapsed = timestamp - startTimeRef.current;
    const params = paramsRef.current;

    // Select generator based on pattern type
    let generator: PatternGenerator;
    if (patternType === 'sine-wave') {
      generator = generateSineWave;
    } else if (patternType === 'triangle-wave') {
      generator = generateTriangleWave;
    } else if (patternType === 'random-walk') {
      generator = randomWalkGeneratorRef.current;
    } else {
      // Should not happen, but fallback to sine
      generator = generateSineWave;
    }

    // Generate position
    const position = generator(
      elapsed,
      params.speed,
      params.minY,
      params.maxY,
      params.increment,
      params.variability
    );

    // Send position to device
    // SDK doesn't have a direct setPosition method, so we use oscillateSet with min=max
    ultra.oscillateSet(params.speed, position, position).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to send position command');
      stop();
    });

    // Schedule next frame
    animationRef.current = requestAnimationFrame(rafCallback);
  }, [ultra, patternType]);

  /**
   * Start manual control motion
   */
  const start = useCallback(async () => {
    if (!ultra) {
      setError('Device not connected');
      return;
    }

    setError(null);

    try {
      if (patternType === 'oscillation') {
        // SDK oscillation mode
        await ultra.oscillateSet(speed, minY, maxY);
        await ultra.oscillateStart();
        setIsRunning(true);
      } else {
        // Custom RAF pattern mode
        startTimeRef.current = performance.now();
        animationRef.current = requestAnimationFrame(rafCallback);
        setIsRunning(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start manual control');
    }
  }, [ultra, patternType, speed, minY, maxY, rafCallback]);

  /**
   * Stop manual control motion
   */
  const stop = useCallback(async () => {
    setError(null);

    try {
      if (patternType === 'oscillation' && ultra) {
        // SDK oscillation mode
        await ultra.oscillateStop();
      } else {
        // Custom RAF pattern mode
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop manual control');
    } finally {
      setIsRunning(false);
    }
  }, [ultra, patternType]);

  /**
   * Update manual control parameters
   */
  const updateParams = useCallback((params: Partial<ManualControlParams>) => {
    if (params.speed !== undefined) {
      const clampedSpeed = Math.max(1, Math.min(100, params.speed));
      setSpeed(clampedSpeed);
    }
    if (params.minY !== undefined || params.maxY !== undefined) {
      const newMinY = params.minY !== undefined ? params.minY : minY;
      const newMaxY = params.maxY !== undefined ? params.maxY : maxY;

      // Validate minY < maxY
      const validatedMinY = Math.min(newMinY, newMaxY - 1);
      const validatedMaxY = Math.max(newMaxY, newMinY + 1);

      setMinY(Math.max(0, Math.min(99, validatedMinY)));
      setMaxY(Math.max(1, Math.min(100, validatedMaxY)));
    }
    if (params.increment !== undefined) {
      setIncrement(Math.max(1, Math.min(50, params.increment)));
    }
    if (params.variability !== undefined) {
      setVariability(Math.max(0, Math.min(100, params.variability)));
    }

    // If running in SDK oscillation mode and speed/minY/maxY changed, update device
    if (isRunning && patternType === 'oscillation') {
      const newSpeed = params.speed !== undefined ? params.speed : speed;
      const newMinY = params.minY !== undefined ? params.minY : minY;
      const newMaxY = params.maxY !== undefined ? params.maxY : maxY;
      debouncedOscillateSet(newSpeed, newMinY, newMaxY);
    }
    // For RAF mode, params are read from ref on next frame, no action needed
  }, [isRunning, patternType, speed, minY, maxY, debouncedOscillateSet]);

  /**
   * Change pattern type (stops if currently running)
   */
  const setPatternType = useCallback((type: PatternType) => {
    if (isRunning) {
      stop();
    }
    setPatternTypeState(type);
  }, [isRunning, stop]);

  // Auto-stop if device disconnects
  useEffect(() => {
    if (!ultra && isRunning) {
      stop();
    }
  }, [ultra, isRunning, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRunning) {
        stop();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isRunning,
    patternType,
    speed,
    minY,
    maxY,
    increment,
    variability,
    start,
    stop,
    updateParams,
    setPatternType,
    error,
  };
}
