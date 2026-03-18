/**
 * ScriptEditorDialog — full-screen modal for editing a script from the library.
 *
 * Provides:
 *   - Full Timeline editor (draw/select, undo/redo, smooth, humanize)
 *   - Save in place (PUT /:id)
 *   - Save as Copy (POST → new library item)
 *   - Export as .funscript file
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, Save, Copy, Download, AlertCircle, CheckCircle } from 'lucide-react';
import type { LibraryItem } from '../../../../server/types/shared';
import type { Funscript, FunscriptAction } from '@/types/funscript';
import { Timeline } from '@/components/timeline/Timeline';
import { useUndoableActions } from '@/hooks/useUndoableActions';
import { libraryApi } from '@/lib/apiClient';
import { exportFunscript } from '@/lib/funscriptExport';

interface ScriptEditorDialogProps {
  item: LibraryItem;
  onClose: () => void;
  /** Called after a successful save or save-as-copy so the parent can refresh */
  onSaved: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function parseActions(item: LibraryItem): FunscriptAction[] {
  try {
    const parsed: Funscript = JSON.parse(item.funscriptData);
    return parsed.actions ?? [];
  } catch {
    return [];
  }
}

function buildFunscriptData(actions: FunscriptAction[]): string {
  return JSON.stringify({ version: '1.0', inverted: false, range: 100, actions });
}

function deriveDuration(item: LibraryItem, actions: FunscriptAction[]): number {
  if (item.duration) return item.duration * 1000;
  return actions.length > 0 ? actions[actions.length - 1].at : 0;
}

export function ScriptEditorDialog({ item, onClose, onSaved }: ScriptEditorDialogProps) {
  const initialActions = parseActions(item);

  const { actions, setActions, undo, redo, canUndo, canRedo, reset } =
    useUndoableActions(initialActions);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [scriptName, setScriptName] = useState(item.funscriptName ?? '');
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  // Reset when the item changes (e.g. dialog reused for a different script)
  useEffect(() => {
    reset(parseActions(item));
    setScriptName(item.funscriptName ?? '');
    setCurrentTimeMs(0);
    setIsDirty(false);
    setSaveStatus('idle');
    setSaveError(null);
  }, [item.id]);

  const handleActionsChange = useCallback((next: FunscriptAction[]) => {
    setActions(next);
    setIsDirty(true);
  }, [setActions]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setScriptName(e.target.value);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await libraryApi.updateById(item.id, {
        funscriptData: buildFunscriptData(actions),
        funscriptName: scriptName || item.funscriptName,
        duration: actions.length > 0 ? actions[actions.length - 1].at / 1000 : item.duration,
      });
      setSaveStatus('saved');
      setIsDirty(false);
      onSaved();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    }
  }, [item, actions, scriptName, onSaved]);

  const handleSaveAsCopy = useCallback(async () => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const baseName = (scriptName || (item.funscriptName ?? 'script')).replace('.funscript', '');
      const copyName = `${baseName}-copy.funscript`;
      await libraryApi.create({
        videoName: null,
        funscriptName: copyName,
        funscriptData: buildFunscriptData(actions),
        duration: actions.length > 0 ? actions[actions.length - 1].at / 1000 : item.duration,
      });
      setSaveStatus('saved');
      onSaved();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    }
  }, [item, actions, scriptName, onSaved]);

  const handleExport = useCallback(() => {
    const baseName = (scriptName || (item.funscriptName ?? 'script')).replace('.funscript', '');
    exportFunscript(actions, `${baseName}-edited.funscript`);
  }, [scriptName, item.funscriptName, actions]);

  const durationMs = deriveDuration(item, actions);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-900 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <input
            type="text"
            value={scriptName}
            onChange={handleNameChange}
            className="text-base font-semibold text-stone-200 bg-transparent border-b border-transparent hover:border-stone-600 focus:border-amber-500 focus:outline-none truncate min-w-0 w-64 transition-colors"
            title="Click to rename"
            placeholder="Unnamed Script"
          />
          {isDirty && (
            <span className="text-xs text-amber-400 flex-shrink-0">Unsaved changes</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status feedback */}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && saveError && (
            <span className="flex items-center gap-1 text-xs text-red-400" title={saveError}>
              <AlertCircle className="w-3.5 h-3.5" />
              {saveError}
            </span>
          )}

          <button
            onClick={handleExport}
            disabled={actions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export as .funscript file"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={handleSaveAsCopy}
            disabled={saveStatus === 'saving' || actions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-700 text-stone-200 hover:bg-stone-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save as new copy in library"
          >
            <Copy className="w-4 h-4" />
            Save as Copy
          </button>

          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving' || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-700 text-white hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save changes to this script"
          >
            <Save className="w-4 h-4" />
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
            title="Close editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timeline editor — fills remaining height */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        {actions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-stone-500">
            No actions in this script
          </div>
        ) : (
          <Timeline
            actions={actions}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            isPlaying={false}
            onSeek={(timeS: number) => setCurrentTimeMs(timeS * 1000)}
            onActionsChange={handleActionsChange}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  );
}
