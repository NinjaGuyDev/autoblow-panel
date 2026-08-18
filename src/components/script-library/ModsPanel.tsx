/**
 * Saved script mods for the Script Library.
 * Applying a mod compiles it against the playing script and hot-swaps the
 * device script — no network call, no model call.
 */

import { useState, useCallback } from 'react';
import { Wand2, Plus, Trash2, RefreshCw, Play, Square, Pencil } from 'lucide-react';
import type { GenerateScriptModResponse, ScriptMod } from '@server/types/shared';
import { useScriptMods } from '@/hooks/useScriptMods';
import { describeMod } from '@/lib/modSummary';
import { ModGenerateDialog } from '@/components/script-library/ModGenerateDialog';

interface ModsPanelProps {
  activeMod: ScriptMod | null;
  isPlaying: boolean;
  isDeviceConnected: boolean;
  scriptDurationMs: number;
  onApply: (mod: ScriptMod) => Promise<void>;
  onClear: () => Promise<void>;
}

export function ModsPanel({
  activeMod,
  isPlaying,
  isDeviceConnected,
  scriptDurationMs,
  onApply,
  onClear,
}: ModsPanelProps) {
  const { mods, loading, error, createMod, renameMod, deleteMod } = useScriptMods();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  /** Failures from applying or clearing a mod, which the mods list owns. */
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const handleSaveGenerated = useCallback(async (
    name: string,
    description: string | null,
    generated: GenerateScriptModResponse,
  ) => createMod({ name, description, definition: generated.definition }), [createMod]);

  const handleApply = useCallback(async (mod: ScriptMod) => {
    setBusyId(mod.id);
    setPlaybackError(null);
    try {
      await onApply(mod);
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : `Could not apply "${mod.name}"`);
    } finally {
      setBusyId(null);
    }
  }, [onApply]);

  const handleClear = useCallback(async () => {
    setPlaybackError(null);
    try {
      await onClear();
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Could not clear the active mod');
    }
  }, [onClear]);

  const handleRename = useCallback(async (mod: ScriptMod) => {
    const name = window.prompt('Rename mod', mod.name);
    if (name === null || name.trim() === '' || name.trim() === mod.name) return;

    try {
      await renameMod(mod.id, name.trim());
    } catch (err) {
      console.error('Failed to rename mod:', err);
    }
  }, [renameMod]);

  const handleDelete = useCallback(async (mod: ScriptMod) => {
    if (!window.confirm(`Delete "${mod.name}"? This action cannot be undone.`)) return;

    setBusyId(mod.id);
    try {
      await deleteMod(mod.id);
    } catch (err) {
      console.error('Failed to delete mod:', err);
    } finally {
      setBusyId(null);
    }
  }, [deleteMod]);

  return (
    <div className="mb-6 p-3 bg-stone-900/50 border border-stone-800 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-medium text-stone-300">Script Mods</h2>
          {activeMod && (
            <span className="px-2 py-0.5 text-xs bg-violet-700/30 text-violet-300 rounded">
              {activeMod.name} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeMod && (
            <button
              onClick={() => { void handleClear(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded-lg hover:bg-stone-700 transition-colors"
            >
              <Square className="w-3 h-3" />
              Clear mod
            </button>
          )}
          <button
            onClick={() => setShowGenerateDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-700 text-white rounded-lg hover:bg-violet-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Create from text
          </button>
        </div>
      </div>

      {(error ?? playbackError) && (
        <div className="mb-3 bg-orange-700/10 border border-orange-700 text-orange-400 px-3 py-2 rounded-lg text-sm">
          {error ?? playbackError}
        </div>
      )}

      {loading && mods.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-stone-500 py-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading mods...
        </div>
      )}

      {!loading && mods.length === 0 && (
        <p className="text-sm text-stone-500 py-2">
          No mods yet. Describe a speed program in plain English and Claude will build one.
        </p>
      )}

      {mods.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mods.map((mod) => {
            const isActive = activeMod?.id === mod.id;

            return (
              <div
                key={mod.id}
                className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-violet-700/10 border-violet-700/60'
                    : 'bg-stone-950/40 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-stone-200 truncate">{mod.name}</h3>
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-stone-800 text-stone-500 rounded">
                      {mod.definition.kind === 'continuous' ? 'continuous' : 'burst'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">{describeMod(mod.definition)}</p>
                  {mod.description && (
                    <p className="mt-1 text-xs text-stone-600 italic truncate" title={mod.description}>
                      {mod.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => { void handleApply(mod); }}
                    disabled={busyId === mod.id || !isDeviceConnected}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isActive
                        ? 'bg-violet-600 text-white hover:bg-violet-500'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                    title={
                      !isDeviceConnected
                        ? 'Device Connection Required'
                        : isPlaying
                          ? 'Apply to the playing script'
                          : 'Apply when playback starts'
                    }
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRename(mod)}
                    className="p-2 bg-stone-800 text-stone-300 rounded-lg hover:bg-stone-700 transition-colors"
                    title="Rename mod"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(mod)}
                    disabled={busyId === mod.id}
                    className="p-2 border border-orange-700 text-orange-400 rounded-lg hover:bg-orange-700 hover:text-white transition-colors disabled:opacity-50"
                    title="Delete mod"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showGenerateDialog && (
        <ModGenerateDialog
          scriptDurationMs={scriptDurationMs > 0 ? scriptDurationMs : null}
          onClose={() => setShowGenerateDialog(false)}
          onSave={handleSaveGenerated}
        />
      )}
    </div>
  );
}
