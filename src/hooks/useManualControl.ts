import { useState, useRef, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { PatternType, ManualControlParams } from '@/types/device';
import { generatePatternFunscript } from '@/lib/funscriptGenerator';

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

  // Track if we're currently uploading a funscript
  const isUploadingRef = useRef(false);

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

  // Debounced funscript regeneration for custom pattern parameter changes
  // Wait 3 seconds after last change before regenerating
  const debouncedRegenerateFunscript = useDebouncedCallback(
    async () => {
      if (!ultra || !isRunning || patternType === 'oscillation') return;
      await uploadAndStartFunscript();
    },
    3000
  );

  /**
   * Upload and start a generated funscript for custom patterns
   */
  const uploadAndStartFunscript = useCallback(async () => {
    if (!ultra || patternType === 'oscillation') return;
    if (isUploadingRef.current) return; // Prevent concurrent uploads

    try {
      isUploadingRef.current = true;
      setError(null);

      // Generate 5-minute funscript from current pattern settings
      const funscript = generatePatternFunscript(
        patternType,
        speed,
        minY,
        maxY,
        increment,
        variability,
        5 * 60 * 1000, // 5 minutes
        100 // Sample every 100ms
      );

      // Upload funscript to device
      await ultra.syncScriptUploadFunscriptFile(funscript);

      // Start playback from beginning
      await ultra.syncScriptStart(0);

      setIsRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload funscript');
      setIsRunning(false);
    } finally {
      isUploadingRef.current = false;
    }
  }, [ultra, patternType, speed, minY, maxY, increment, variability]);

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
        // Custom pattern mode - upload and start funscript
        await uploadAndStartFunscript();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start manual control');
    }
  }, [ultra, patternType, speed, minY, maxY, uploadAndStartFunscript]);

  /**
   * Stop manual control motion
   */
  const stop = useCallback(async () => {
    setError(null);

    try {
      if (patternType === 'oscillation' && ultra) {
        // SDK oscillation mode
        await ultra.oscillateStop();
      } else if (ultra) {
        // Custom pattern mode - stop funscript playback
        await ultra.syncScriptStop();
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

    // If running, update device with debouncing
    if (isRunning) {
      if (patternType === 'oscillation') {
        // SDK oscillation mode - debounce oscillateSet calls
        const newSpeed = params.speed !== undefined ? params.speed : speed;
        const newMinY = params.minY !== undefined ? params.minY : minY;
        const newMaxY = params.maxY !== undefined ? params.maxY : maxY;
        debouncedOscillateSet(newSpeed, newMinY, newMaxY);
      } else {
        // Custom pattern mode - debounce funscript regeneration (3 seconds)
        debouncedRegenerateFunscript();
      }
    }
  }, [isRunning, patternType, speed, minY, maxY, debouncedOscillateSet, debouncedRegenerateFunscript]);

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
