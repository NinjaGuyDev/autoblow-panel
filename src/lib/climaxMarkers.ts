/**
 * Climax records as positions in a script, and navigation between them.
 *
 * runwayData format (stored by this app):
 *   { climaxTimeMs: number, actions: FunscriptAction[] }
 * Legacy fallback: raw FunscriptAction[] array (uses max `at` as position)
 */

import type { ClimaxRecord } from '@server/types/shared';

interface RunwayPayload {
  climaxTimeMs: number;
}

/** Script position of a climax record in original time, or null when unreadable. */
export function parseClimaxTimeMs(record: ClimaxRecord): number | null {
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

/** Unique, ascending climax positions; unreadable records are dropped. */
export function climaxMarkersFrom(records: readonly ClimaxRecord[]): number[] {
  const positions = records
    .map(parseClimaxTimeMs)
    .filter((ms): ms is number => ms !== null && Number.isFinite(ms) && ms >= 0);
  return [...new Set(positions)].sort((a, b) => a - b);
}

/**
 * How close ahead a marker may be and still count as "here" rather than next,
 * so a jump does not land on the marker just reached.
 */
const NEXT_MARKER_TOLERANCE_MS = 500;

/**
 * How far past a marker the playhead must be before "previous" returns to it
 * instead of the one before — the same rule a media player uses for restarting
 * a track, so repeated presses walk back through the markers.
 */
const PREVIOUS_MARKER_GRACE_MS = 2_000;

/** First marker ahead of `currentMs`, or null when none remain. */
export function nextMarker(markersMs: readonly number[], currentMs: number): number | null {
  return markersMs.find(ms => ms > currentMs + NEXT_MARKER_TOLERANCE_MS) ?? null;
}

/** Last marker behind `currentMs`, or null when none precede it. */
export function previousMarker(markersMs: readonly number[], currentMs: number): number | null {
  const threshold = currentMs - PREVIOUS_MARKER_GRACE_MS;
  for (let i = markersMs.length - 1; i >= 0; i--) {
    const ms = markersMs[i]!;
    if (ms < threshold) return ms;
  }
  return null;
}
