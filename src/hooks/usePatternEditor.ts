import { useState, useCallback } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { FunscriptAction } from '@/types/funscript';
import type { CustomPatternDefinition } from '@/types/patterns';
import { scalePatternDuration, adjustIntensity, createLoopTransition } from '@/lib/patternTransform';
import { customPatternApi } from '@/lib/apiClient';

/**
 * Pattern editor hook managing full editing lifecycle
 * Handles state, transformations, demo playback, and persistence
 */
export function usePatternEditor() {
  const [editedPattern, setEditedPattern] = useState<CustomPatternDefinition | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  /**
   * Opens editor with a pattern (typically a copy from preset)
   */
  const openEditor = useCallback((pattern: CustomPatternDefinition) => {
    setEditedPattern(pattern);
    setIsEditorOpen(true);
    setSaveError(null);
    setDemoError(null);
  }, []);

  /**
   * Closes editor and clears state
   */
  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditedPattern(null);
    setSaveError(null);
    setDemoError(null);
    setIsDemoPlaying(false);
  }, []);

  /**
   * Updates pattern actions (immutable)
   */
  const updateActions = useCallback((actions: FunscriptAction[]) => {
    setEditedPattern((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        actions: actions,
        lastModified: Date.now(),
      };
    });
  }, []);

  /**
   * Changes pattern duration by scaling actions proportionally
   */
  const changeDuration = useCallback((newDurationSeconds: number) => {
    // Validate bounds
    if (newDurationSeconds < 0.5 || newDurationSeconds > 300) {
      return;
    }

    setEditedPattern((prev) => {
      if (!prev) return null;

      const newDurationMs = Math.round(newDurationSeconds * 1000);
      const scaledActions = scalePatternDuration(prev.actions, newDurationMs);

      return {
        ...prev,
        durationMs: newDurationMs,
        actions: scaledActions,
        lastModified: Date.now(),
      };
    });
  }, []);

  /**
   * Adjusts pattern intensity by shifting positions
   */
  const changeIntensity = useCallback((delta: number) => {
    setEditedPattern((prev) => {
      if (!prev) return null;

      const adjustedActions = adjustIntensity(prev.actions, delta);

      return {
        ...prev,
        actions: adjustedActions,
        lastModified: Date.now(),
      };
    });
  }, []);

  /**
   * Starts demo playback on device with loop transitions
   */
  const startDemo = useCallback(async (ultra: Ultra) => {
    if (!editedPattern) return;

    try {
      setDemoError(null);

      // Get pattern actions
      const actions = editedPattern.actions;

      // Append loop transition for seamless looping
      const loopTransition = createLoopTransition(actions);
      const loopActions = [...actions, ...loopTransition];

      // Create funscript object
      const funscript = {
        version: '1.0',
        inverted: false,
        range: 100,
        actions: loopActions,
      };

      // Upload to device
      await ultra.syncScriptUploadFunscriptFile(funscript);

      // Start playback from beginning
      await ultra.syncScriptStart(0);

      setIsDemoPlaying(true);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Failed to start demo');
    }
  }, [editedPattern]);

  /**
   * Stops demo playback
   */
  const stopDemo = useCallback(async (ultra: Ultra) => {
    try {
      await ultra.syncScriptStop();
      setIsDemoPlaying(false);
      setDemoError(null);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Failed to stop demo');
    }
  }, []);

  /**
   * Saves pattern to backend
   */
  const savePattern = useCallback(async () => {
    if (!editedPattern) return;

    try {
      setIsSaving(true);
      setSaveError(null);

      // Construct funscriptData JSON
      const funscriptData = JSON.stringify(editedPattern.actions);

      // Construct patternMetadata JSON
      const patternMetadata = JSON.stringify({
        name: editedPattern.name,
        intensity: editedPattern.intensity,
        tags: editedPattern.tags,
        durationMs: editedPattern.durationMs,
      });

      let savedItem;

      // Update or create
      if (editedPattern.libraryItemId) {
        // PATCH update existing
        savedItem = await customPatternApi.update(editedPattern.libraryItemId, {
          funscriptData,
          patternMetadata,
        });
      } else {
        // POST create new
        savedItem = await customPatternApi.create({
          videoName: `pattern-${editedPattern.id}`, // Placeholder video name
          funscriptName: `${editedPattern.name}.funscript`,
          funscriptData,
          isCustomPattern: 1,
          originalPatternId: editedPattern.originalPatternId,
          patternMetadata,
        });
      }

      // Update editedPattern with libraryItemId
      setEditedPattern((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          libraryItemId: savedItem.id,
          lastModified: Date.now(),
        };
      });

      setIsSaving(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save pattern');
      setIsSaving(false);
    }
  }, [editedPattern]);

  return {
    editedPattern,
    isEditorOpen,
    isSaving,
    saveError,
    isDemoPlaying,
    demoError,
    openEditor,
    closeEditor,
    updateActions,
    changeDuration,
    changeIntensity,
    startDemo,
    stopDemo,
    savePattern,
  };
}
