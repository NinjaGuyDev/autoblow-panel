import { useState, useCallback, useRef } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { FunscriptAction } from '@/types/funscript';
import type { CustomPatternDefinition } from '@/types/patterns';
import { scalePatternDuration, adjustIntensity, createLoopTransition } from '@/lib/patternTransform';
import { buildFunscript } from '@/lib/funscriptConverter';
import { customPatternApi, mediaApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDemoLoop } from '@/hooks/useDemoLoop';

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
  const [scriptDurationMs, setScriptDurationMs] = useState(0);
  const ultraRef = useRef<Ultra | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioFileSize, setAudioFileSize] = useState<number | null>(null);

  useDemoLoop(ultraRef.current, isDemoPlaying, scriptDurationMs);

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
   * Updates pattern name
   */
  const changeName = useCallback((name: string) => {
    setEditedPattern((prev) => {
      if (!prev) return null;
      return { ...prev, name, lastModified: Date.now() };
    });
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
    // Validate bounds (up to 1 hour)
    if (newDurationSeconds < 0.5 || newDurationSeconds > 3600) {
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

      // Track ultra ref and script duration for loop detection
      ultraRef.current = ultra;
      if (loopActions.length === 0) return;
      setScriptDurationMs(loopActions[loopActions.length - 1]!.at);

      // Create funscript object and upload to device
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ultra.syncScriptUploadFunscriptFile(buildFunscript(loopActions) as any);

      // Start playback from beginning
      await ultra.syncScriptStart(0);

      setIsDemoPlaying(true);
    } catch (err) {
      setDemoError(getErrorMessage(err, 'Failed to start demo'));
    }
  }, [editedPattern]);

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
        ...(editedPattern.audioFile ? { audioFile: editedPattern.audioFile } : {}),
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
          duration: editedPattern.durationMs / 1000,
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
      setSaveError(getErrorMessage(err, 'Failed to save pattern'));
      setIsSaving(false);
    }
  }, [editedPattern]);

  /**
   * Uploads an audio file and attaches it to the current pattern.
   * Replaces the existing audio file if one is already attached.
   * @throws Never — errors are surfaced via audioError state
   */
  const uploadAudio = useCallback(async (file: File) => {
    if (!editedPattern) return;
    try {
      setIsUploadingAudio(true);
      setAudioError(null);
      const result = await mediaApi.uploadAudio(file, editedPattern.audioFile);
      setAudioFileSize(result.size);
      setEditedPattern((prev) => {
        if (!prev) return null;
        return { ...prev, audioFile: result.stored, lastModified: Date.now() };
      });
    } catch (err) {
      setAudioError(getErrorMessage(err, 'Failed to upload audio'));
    } finally {
      setIsUploadingAudio(false);
    }
  }, [editedPattern]);

  /**
   * Removes the audio file attached to the current pattern.
   * Deletes the file from the backend media directory.
   * @throws Never — errors are surfaced via audioError state
   */
  const removeAudio = useCallback(async () => {
    if (!editedPattern?.audioFile) return;
    try {
      setAudioError(null);
      await mediaApi.deleteAudio(editedPattern.audioFile);
      setEditedPattern((prev) => {
        if (!prev) return null;
        return { ...prev, audioFile: undefined, lastModified: Date.now() };
      });
    } catch (err) {
      setAudioError(getErrorMessage(err, 'Failed to remove audio'));
    }
  }, [editedPattern]);

  return {
    editedPattern,
    isEditorOpen,
    isSaving,
    saveError,
    isDemoPlaying,
    demoError,
    isUploadingAudio,
    audioError,
    audioFileSize,
    openEditor,
    closeEditor,
    changeName,
    updateActions,
    changeDuration,
    changeIntensity,
    startDemo,
    stopDemo,
    savePattern,
    uploadAudio,
    removeAudio,
  };
}
