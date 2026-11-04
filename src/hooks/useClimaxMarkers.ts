/**
 * Loads the recorded climax positions for the script on the device, so the
 * transport bar can mark and jump to them.
 */

import { useEffect, useState } from 'react';
import type { ClimaxRecord } from '@server/types/shared';
import { climaxMarkersFrom } from '@/lib/climaxMarkers';

const NO_MARKERS: number[] = [];

interface UseClimaxMarkersParams {
  libraryItemId: number | null;
  /** Bump to reload after records are added or deleted elsewhere. */
  revision: number;
  /** Fetches a script's records; rejects when the request fails. */
  fetchRecords: (libraryItemId: number) => Promise<ClimaxRecord[]>;
}

/** Ascending climax positions in original script time; empty while loading or on failure. */
export function useClimaxMarkers({ libraryItemId, revision, fetchRecords }: UseClimaxMarkersParams): number[] {
  const [loaded, setLoaded] = useState<{ itemId: number; markersMs: number[] } | null>(null);

  useEffect(() => {
    if (libraryItemId === null) return;
    let cancelled = false;

    fetchRecords(libraryItemId)
      .then(records => {
        if (!cancelled) setLoaded({ itemId: libraryItemId, markersMs: climaxMarkersFrom(records) });
      })
      .catch(err => {
        // Markers are a navigation aid; playback carries on without them
        console.error('Failed to load climax markers:', err);
      });

    return () => { cancelled = true; };
  }, [libraryItemId, revision, fetchRecords]);

  // Markers from a previous script must never show against the current one
  return loaded !== null && loaded.itemId === libraryItemId ? loaded.markersMs : NO_MARKERS;
}
