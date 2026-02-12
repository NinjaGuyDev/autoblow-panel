/**
 * Script Library page — browse and play script-only items directly on the device.
 * Supports single-script looping and randomized continuous playback.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Trash2, Play, Square, FileText, Shuffle, ListOrdered, Zap, Pause } from 'lucide-react';
import type { LibraryItem } from '../../../server/types/shared';
import type { Funscript, FunscriptAction } from '@/types/funscript';
import type { RandomizeMode } from '@/hooks/useScriptPlayback';
import { Timeline } from '@/components/timeline/Timeline';
import { useUndoableActions } from '@/hooks/useUndoableActions';
import { exportFunscript } from '@/lib/funscriptExport';

interface ScriptLibraryPageProps {
  scripts: LibraryItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  deleteItem: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  isPlaying: boolean;
  isPaused: boolean;
  currentScriptId: number | null;
  nextScriptId: number | null;
  playbackError: string | null;
  randomizeMode: RandomizeMode;
  setRandomizeMode: (mode: RandomizeMode) => void;
  playSingle: (item: LibraryItem) => Promise<void>;
  stop: () => Promise<void>;
  startRandomize: () => Promise<void>;
  togglePause: () => Promise<void>;
  isDeviceConnected: boolean;
  currentActions: FunscriptAction[];
  currentTimeMs: number;
  scriptDurationMs: number;
  onSeek: (timeMs: number) => Promise<void>;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Compute script length in seconds from funscriptData JSON.
 * Returns null if parsing fails or no actions exist.
 */
function getScriptLengthSeconds(item: LibraryItem): number | null {
  try {
    const parsed: Funscript = JSON.parse(item.funscriptData);
    const actions = parsed.actions;
    if (!actions || actions.length === 0) return null;
    return actions[actions.length - 1].at / 1000;
  } catch {
    return null;
  }
}

/**
 * Format script length: "Xs" for under 60s, "M:SS" for 60s+
 */
function formatScriptLength(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const RANDOMIZE_OPTIONS: { mode: RandomizeMode; label: string; icon: typeof Shuffle }[] = [
  { mode: 'off', label: 'Off', icon: Square },
  { mode: 'play-all', label: 'Play All', icon: ListOrdered },
  { mode: 'full-random', label: 'Random', icon: Shuffle },
];

export function ScriptLibraryPage({
  scripts,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  deleteItem,
  refresh,
  isPlaying,
  isPaused,
  currentScriptId,
  nextScriptId,
  playbackError,
  randomizeMode,
  setRandomizeMode,
  playSingle,
  stop,
  startRandomize,
  togglePause,
  isDeviceConnected,
  currentActions,
  currentTimeMs,
  scriptDurationMs,
  onSeek,
}: ScriptLibraryPageProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(() => localStorage.getItem('script-library-show-timeline') === 'true');

  // Undoable editing state for the timeline
  const { actions: editableActions, setActions, undo, redo, canUndo, canRedo, reset: resetEditable } = useUndoableActions(currentActions);

  // Reset editable actions when the current script changes
  useEffect(() => {
    resetEditable(currentActions);
  }, [currentScriptId]);

  const handleTimelineToggle = useCallback((checked: boolean) => {
    setShowTimeline(checked);
    localStorage.setItem('script-library-show-timeline', String(checked));
  }, []);

  const handleTimelineSeek = useCallback((timeSeconds: number) => {
    onSeek(timeSeconds * 1000);
  }, [onSeek]);

  const handleTimelineExport = useCallback(() => {
    const currentScript = scripts.find(s => s.id === currentScriptId);
    const filename = currentScript?.funscriptName?.replace('.funscript', '-edited.funscript') ?? 'script-edited.funscript';
    exportFunscript(editableActions, filename);
  }, [editableActions, scripts, currentScriptId]);

  const timelineDurationMs = scriptDurationMs > 0
    ? scriptDurationMs
    : editableActions.length > 0
      ? editableActions[editableActions.length - 1].at
      : 0;

  const handleDelete = async (id: number, name: string) => {
    const confirmed = window.confirm(`Delete "${name}"? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteItem(id);
    } catch (err) {
      console.error('Failed to delete script:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const currentScript = scripts.find(s => s.id === currentScriptId);
  const nextScript = scripts.find(s => s.id === nextScriptId);

  return (
    <div
      role="tabpanel"
      id="panel-script-library"
      aria-labelledby="tab-script-library"
      className={`container mx-auto px-4 py-6 ${showTimeline && editableActions.length > 0 ? 'pb-64' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>
            Script Library
          </h1>
          <span className="px-2 py-1 text-sm bg-stone-800/50 text-stone-500 rounded-lg" style={{ fontFamily: 'var(--font-mono)' }}>
            {scripts.length} {scripts.length === 1 ? 'script' : 'scripts'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTimeline}
              onChange={(e) => handleTimelineToggle(e.target.checked)}
              className="accent-amber-600 w-4 h-4 cursor-pointer"
            />
            Show Timeline
          </label>
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2 hover:bg-stone-800/50 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh scripts"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search scripts..."
          className="w-full pl-10 pr-4 py-2 bg-stone-900/50 border border-stone-800 rounded-lg text-stone-200 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-700/40"
        />
      </div>

      {/* Control bar */}
      <div
        className={`flex flex-wrap items-center gap-3 mb-6 p-3 bg-stone-900/50 border border-stone-800 rounded-xl ${!isDeviceConnected ? 'opacity-50' : ''}`}
        title={!isDeviceConnected ? 'Device Connection Required' : undefined}
      >
        {/* Randomize mode chips */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-500 mr-1">Randomize:</span>
          {RANDOMIZE_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setRandomizeMode(mode)}
              disabled={!isDeviceConnected}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                randomizeMode === mode
                  ? 'bg-amber-700 text-white'
                  : 'bg-stone-800/50 text-stone-500 hover:bg-stone-800/80 disabled:hover:bg-stone-800/50'
              }`}
              title={!isDeviceConnected ? 'Device Connection Required' : undefined}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Start/Stop randomize button */}
        {randomizeMode !== 'off' && (
          <button
            onClick={isPlaying ? stop : startRandomize}
            disabled={scripts.length === 0 || !isDeviceConnected}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isPlaying
                ? 'bg-orange-700 text-white hover:bg-orange-600'
                : 'bg-amber-700 text-white hover:bg-amber-600'
            }`}
            title={!isDeviceConnected ? 'Device Connection Required' : undefined}
          >
            {isPlaying ? (
              <>
                <Square className="w-3 h-3" />
                Stop
              </>
            ) : (
              <>
                <Zap className="w-3 h-3" />
                Start
              </>
            )}
          </button>
        )}

        {/* Now Playing / Up Next indicators */}
        {isPlaying && (
          <div className="flex items-center gap-3 ml-auto text-xs">
            {currentScript && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
                <span className="truncate max-w-[150px]">
                  {currentScript.funscriptName || 'Playing'}
                </span>
              </div>
            )}
            {nextScript && randomizeMode !== 'off' && (
              <div className="flex items-center gap-1.5 text-stone-500">
                <span>Next:</span>
                <span className="truncate max-w-[120px]">
                  {nextScript.funscriptName || 'Unknown'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Playback error */}
      {playbackError && (
        <div className="bg-orange-700/10 border border-orange-700 text-orange-400 px-4 py-3 rounded-lg mb-4">
          {playbackError}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-orange-700/10 border border-orange-700 text-orange-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && scripts.length === 0 && (
        <div className="text-center py-12 text-stone-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading scripts...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && scripts.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-stone-500" />
          <h2 className="text-xl font-semibold text-stone-200 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            {searchQuery ? `No scripts matching "${searchQuery}"` : 'No standalone scripts yet'}
          </h2>
          {!searchQuery && (
            <p className="text-stone-500">
              Scripts without an associated video will appear here.
            </p>
          )}
        </div>
      )}

      {/* Script card grid */}
      {scripts.length > 0 && (
        <div className="relative">
          {/* Paused overlay */}
          {isPlaying && isPaused && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-950/60 backdrop-blur-[2px] rounded-xl">
              <div className="flex items-center gap-3 px-6 py-3 bg-stone-900/90 border border-amber-700/50 rounded-xl shadow-lg">
                <Pause className="w-6 h-6 text-amber-400" />
                <span className="text-lg font-medium text-amber-400" style={{ fontFamily: 'var(--font-display)' }}>
                  Paused
                </span>
              </div>
            </div>
          )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((item) => {
            const isCurrent = currentScriptId === item.id;
            const isNext = nextScriptId === item.id && randomizeMode !== 'off';

            return (
              <div
                key={item.id}
                className={`relative bg-stone-900/50 border rounded-xl overflow-hidden transition-colors ${
                  isCurrent
                    ? 'border-amber-600 shadow-[0_0_12px_rgba(217,119,6,0.15)]'
                    : isNext
                      ? 'border-amber-800/50'
                      : 'border-stone-800 hover:border-stone-600'
                }`}
              >
                <div className="relative p-4">
                  {/* Status badges */}
                  <div className="flex gap-2 mb-3">
                    <div className="flex items-center gap-1 text-xs bg-stone-800/80 px-2 py-1 rounded">
                      <FileText className="w-3 h-3" />
                      <span>Script</span>
                    </div>
                    {(() => {
                      const length = formatScriptLength(getScriptLengthSeconds(item));
                      return length ? (
                        <div className="text-xs bg-stone-800/80 px-2 py-1 rounded" style={{ fontFamily: 'var(--font-mono)' }}>
                          {length}
                        </div>
                      ) : null;
                    })()}
                    {isCurrent && (
                      <div className="flex items-center gap-1 text-xs bg-amber-700/30 text-amber-400 px-2 py-1 rounded ml-auto">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                        </span>
                        Now Playing
                      </div>
                    )}
                    {isNext && !isCurrent && (
                      <div className="text-xs bg-stone-700/50 text-stone-400 px-2 py-1 rounded ml-auto">
                        Up Next
                      </div>
                    )}
                  </div>

                  {/* Script name */}
                  <h3 className="text-lg font-semibold text-stone-200 mb-1 truncate" title={item.funscriptName || 'Unnamed'}>
                    {item.funscriptName || 'Unnamed Script'}
                  </h3>

                  {/* Metadata */}
                  <div className="text-xs text-stone-500 mb-4">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{formatRelativeTime(item.lastModified)}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => playSingle(item)}
                      disabled={!isDeviceConnected}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isCurrent
                          ? 'bg-amber-600 text-white hover:bg-amber-500'
                          : 'bg-amber-700 text-white hover:bg-amber-600'
                      }`}
                      title={!isDeviceConnected ? 'Device Connection Required' : undefined}
                    >
                      <Play className="w-4 h-4" />
                      <span>{isCurrent ? 'Restart' : 'Play'}</span>
                    </button>
                    {isCurrent && (
                      <button
                        onClick={stop}
                        disabled={!isDeviceConnected}
                        className="px-3 py-2 bg-orange-700 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!isDeviceConnected ? 'Device Connection Required' : 'Stop playback'}
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item.id, item.funscriptName || 'this script')}
                      disabled={deletingId === item.id}
                      className="px-3 py-2 border border-orange-700 text-orange-400 rounded-lg hover:bg-orange-700 hover:text-white transition-colors disabled:opacity-50"
                      title="Delete script"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Sticky timeline panel */}
      {showTimeline && editableActions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950 border-t border-stone-800 shadow-2xl">
          <div className="container mx-auto px-4 py-2">
            <Timeline
              actions={editableActions}
              currentTimeMs={currentTimeMs}
              durationMs={timelineDurationMs}
              isPlaying={isPlaying}
              onSeek={handleTimelineSeek}
              onActionsChange={setActions}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onExport={handleTimelineExport}
            />
          </div>
        </div>
      )}
    </div>
  );
}
