import { useState, useCallback, useRef } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { FunscriptAction } from '@/types/funscript';
import type { WaypointDefinition } from '@/types/patterns';
import { waypointsToActions } from '@/lib/waypointGenerator';
import { createLoopTransition } from '@/lib/patternTransform';
import { customPatternApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDemoLoop } from '@/hooks/useDemoLoop';

/**
 * Waypoint builder hook managing waypoint-based pattern creation lifecycle
 * Handles state, waypoint CRUD, demo playback, and persistence
 */
export function useWaypointBuilder() {
  // Default waypoints: 0ms at pos 0, 2500ms at pos 100, 5000ms at pos 0
  const defaultWaypoints = (): WaypointDefinition[] => [
    { pos: 0, timeMs: 0, interpolation: 'linear' },
    { pos: 100, timeMs: 2500, interpolation: 'linear' },
    { pos: 0, timeMs: 5000, interpolation: 'linear' },
  ];

  const [waypoints, setWaypoints] = useState<WaypointDefinition[]>(defaultWaypoints());
  const [patternName, setPatternName] = useState('Custom Pattern');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [scriptDurationMs, setScriptDurationMs] = useState(0);
  const ultraRef = useRef<Ultra | null>(null);

  useDemoLoop(ultraRef.current, isDemoPlaying, scriptDurationMs);

  /**
   * Opens builder with default waypoints
   */
  const openBuilder = useCallback(() => {
    setWaypoints(defaultWaypoints());
    setPatternName('Custom Pattern');
    setSelectedIndex(null);
    setIsOpen(true);
    setSaveError(null);
    setDemoError(null);
  }, []);

  /**
   * Closes builder and resets state
   */
  const closeBuilder = useCallback(() => {
    setIsOpen(false);
    setWaypoints(defaultWaypoints());
    setPatternName('Custom Pattern');
    setSelectedIndex(null);
    setSaveError(null);
    setDemoError(null);
    setIsDemoPlaying(false);
  }, []);

  /**
   * Adds a new waypoint at the specified position and time
   * Only adds if count < 10
   * Sorts by timeMs after adding
   * Interpolation defaults to 'linear'
   */
  const addWaypoint = useCallback((pos: number, timeMs: number) => {
    setWaypoints((prev) => {
      if (prev.length >= 10) return prev;

      const newWaypoint: WaypointDefinition = {
        pos: Math.round(pos),
        timeMs: Math.round(timeMs),
        interpolation: 'linear',
      };

      const updated = [...prev, newWaypoint];
      // Sort by timeMs
      updated.sort((a, b) => a.timeMs - b.timeMs);
      return updated;
    });
  }, []);

  /**
   * Updates a waypoint at the specified index
   * Re-sorts if timeMs changed
   * Validates timeMs is at least 50ms apart from adjacent waypoints
   */
  const updateWaypoint = useCallback((index: number, updates: Partial<WaypointDefinition>) => {
    setWaypoints((prev) => {
      if (index < 0 || index >= prev.length) return prev;

      // Apply updates
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };

      // If timeMs changed, validate and clamp
      if (updates.timeMs !== undefined) {
        const prevWaypoint = index > 0 ? updated[index - 1] : null;
        const nextWaypoint = index < updated.length - 1 ? updated[index + 1] : null;

        let newTimeMs = updates.timeMs;

        // Clamp to at least 50ms after previous
        if (prevWaypoint) {
          newTimeMs = Math.max(newTimeMs, prevWaypoint.timeMs + 50);
        }

        // Clamp to at least 50ms before next
        if (nextWaypoint) {
          newTimeMs = Math.min(newTimeMs, nextWaypoint.timeMs - 50);
        }

        updated[index].timeMs = Math.round(newTimeMs);

        // Re-sort by timeMs
        updated.sort((a, b) => a.timeMs - b.timeMs);
      }

      // Clamp position to 0-100
      if (updates.pos !== undefined) {
        updated[index].pos = Math.max(0, Math.min(100, Math.round(updated[index].pos)));
      }

      return updated;
    });
  }, []);

  /**
   * Removes a waypoint at the specified index
   * Only removes if count > 3
   */
  const removeWaypoint = useCallback((index: number) => {
    setWaypoints((prev) => {
      if (prev.length <= 3) return prev;
      if (index < 0 || index >= prev.length) return prev;

      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });

    // Deselect if the removed waypoint was selected
    setSelectedIndex((prev) => {
      if (prev === index) return null;
      if (prev !== null && prev > index) return prev - 1;
      return prev;
    });
  }, []);

  /**
   * Selects a waypoint by index
   */
  const selectWaypoint = useCallback((index: number | null) => {
    setSelectedIndex(index);
  }, []);

  /**
   * Generates FunscriptAction array from current waypoints
   */
  const generateActions = useCallback((): FunscriptAction[] => {
    return waypointsToActions(waypoints);
  }, [waypoints]);

  /**
   * Starts demo playback on device with loop transitions
   */
  const startDemo = useCallback(async (ultra: Ultra) => {
    try {
      setDemoError(null);

      // Generate actions from waypoints
      const actions = waypointsToActions(waypoints);

      // Append loop transition for seamless looping
      const loopTransition = createLoopTransition(actions);
      const loopActions = [...actions, ...loopTransition];

      // Track ultra ref and script duration for loop detection
      ultraRef.current = ultra;
      setScriptDurationMs(loopActions[loopActions.length - 1].at);

      // Create funscript object
      const funscript = {
        version: '1.0',
        inverted: false,
        range: 100,
        actions: loopActions,
      };

      // Upload to device
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ultra.syncScriptUploadFunscriptFile(funscript as any);

      // Start playback from beginning
      await ultra.syncScriptStart(0);

      setIsDemoPlaying(true);
    } catch (err) {
      setDemoError(getErrorMessage(err, 'Failed to start demo'));
    }
  }, [waypoints]);

  /**
   * Stops demo playback
   */
  const stopDemo = useCallback(async (ultra: Ultra) => {
    try {
      await ultra.syncScriptStop();
      setIsDemoPlaying(false);
      setScriptDurationMs(0);
      ultraRef.current = null;
      setDemoError(null);
    } catch (err) {
      setDemoError(getErrorMessage(err, 'Failed to stop demo'));
    }
  }, []);

  /**
   * Saves pattern to backend
   * Returns the saved library item
   */
  const savePattern = useCallback(async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      // Generate actions from waypoints
      const actions = waypointsToActions(waypoints);

      // Construct funscriptData JSON
      const funscriptData = JSON.stringify(actions);

      // Get duration from last waypoint
      const durationMs = waypoints[waypoints.length - 1]?.timeMs ?? 0;

      // Construct patternMetadata JSON
      const patternMetadata = JSON.stringify({
        name: patternName,
        intensity: 'medium',
        tags: ['smooth'],
        durationMs,
      });

      // POST create new
      const savedItem = await customPatternApi.create({
        videoName: `pattern-${Date.now()}`, // Placeholder video name
        funscriptName: `${patternName}.funscript`,
        funscriptData,
        duration: durationMs / 1000,
        isCustomPattern: 1,
        originalPatternId: 'waypoint-builder',
        patternMetadata,
      });

      setIsSaving(false);
      return savedItem;
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save pattern'));
      setIsSaving(false);
      throw err;
    }
  }, [waypoints, patternName]);

  // Computed values
  const canAddWaypoint = waypoints.length < 10;
  const canRemoveWaypoint = waypoints.length > 3;
  const totalDurationMs = waypoints[waypoints.length - 1]?.timeMs ?? 0;

  return {
    waypoints,
    patternName,
    selectedIndex,
    isOpen,
    isSaving,
    saveError,
    isDemoPlaying,
    demoError,
    canAddWaypoint,
    canRemoveWaypoint,
    totalDurationMs,
    openBuilder,
    closeBuilder,
    setPatternName,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    selectWaypoint,
    generateActions,
    startDemo,
    stopDemo,
    savePattern,
  };
}
