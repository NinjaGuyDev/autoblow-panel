/**
 * ClimaxEditorDialog
 *
 * Shows and manages all climax records for a specific library script.
 * Each record displays the position in the script where it occurred
 * and when it was recorded (wall-clock), plus a delete button.
 *
 * runwayData format (stored by this app):
 *   { climaxTimeMs: number, actions: FunscriptAction[] }
 * Legacy fallback: raw FunscriptAction[] array (uses max `at` as position)
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Trash2, RefreshCw, Flag } from 'lucide-react';
import type { LibraryItem, ClimaxRecord } from '../../../../server/types/shared';
import { analyticsApi } from '@/lib/apiClient';
import { formatTimeMs } from '@/lib/format';

interface ClimaxEditorDialogProps {
  item: LibraryItem;
  onClose: () => void;
}

// ── runway data parsing ─────────────────────────────────────────────────────

interface RunwayPayload {
  climaxTimeMs: number;
}

function parseClimaxTimeMs(record: ClimaxRecord): number | null {
  try {
    const parsed: unknown = JSON.parse(record.runwayData);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const payload = parsed as RunwayPayload;
      if (typeof payload.climaxTimeMs === 'number') return payload.climaxTimeMs;
    }
    // Legacy: raw array — use max `at` value
    if (Array.isArray(parsed) && parsed.length > 0) {
      return Math.max(...(parsed as Array<{ at: number }>).map(a => a.at));
    }
  } catch {
    // malformed — fall through
  }
  return null;
}

function formatWallTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── component ───────────────────────────────────────────────────────────────

export function ClimaxEditorDialog({ item, onClose }: ClimaxEditorDialogProps) {
  const [records, setRecords] = useState<ClimaxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsApi.getClimaxRecordsByLibraryItem(item.id);
      // Sort chronologically: earliest script position first
      const sorted = [...data].sort((a, b) => {
        const ta = parseClimaxTimeMs(a) ?? 0;
        const tb = parseClimaxTimeMs(b) ?? 0;
        return ta - tb;
      });
      setRecords(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (record: ClimaxRecord) => {
    setDeletingId(record.id);
    try {
      await analyticsApi.deleteClimaxRecord(record.id);
      setRecords(prev => prev.filter(r => r.id !== record.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const scriptName = item.funscriptName ?? 'Unnamed Script';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
          <div className="flex items-center gap-2 min-w-0">
            <Flag className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-stone-200 truncate" title={scriptName}>
                {scriptName}
              </h2>
              <p className="text-xs text-stone-500">Climax records</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 text-stone-500 hover:text-stone-300 hover:bg-stone-800 rounded-lg transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3 max-h-80 overflow-y-auto">
          {error && (
            <p className="text-sm text-red-400 mb-3">{error}</p>
          )}

          {loading && records.length === 0 && (
            <div className="flex items-center justify-center py-8 text-stone-500 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {!loading && records.length === 0 && (
            <div className="text-center py-8 text-stone-500">
              <Flag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No climax records yet.</p>
              <p className="text-xs mt-1 text-stone-600">
                Pause while playing to record one.
              </p>
            </div>
          )}

          {records.length > 0 && (
            <ul className="space-y-1">
              {records.map((record, index) => {
                const climaxTimeMs = parseClimaxTimeMs(record);
                return (
                  <li
                    key={record.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-stone-800/50 hover:bg-stone-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-stone-500 w-4 text-right flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-mono text-rose-300">
                          {climaxTimeMs !== null ? formatTimeMs(climaxTimeMs) : '—'}
                        </span>
                        <span className="text-xs text-stone-500 ml-2">
                          {formatWallTime(record.createdAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(record)}
                      disabled={deletingId === record.id}
                      className="p-1.5 text-stone-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-40 flex-shrink-0"
                      title="Delete this record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {records.length > 0 && (
          <div className="px-4 py-2 border-t border-stone-800 text-xs text-stone-600 text-right">
            {records.length} record{records.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
