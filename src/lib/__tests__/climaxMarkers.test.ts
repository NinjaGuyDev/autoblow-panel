import { describe, it, expect } from 'vitest';
import type { ClimaxRecord } from '@server/types/shared';
import { climaxMarkersFrom, nextMarker, parseClimaxTimeMs, previousMarker } from '@/lib/climaxMarkers';

function record(runwayData: string, id = 1): ClimaxRecord {
  return { id, sessionId: null, timestamp: '', runwayData, libraryItemId: 7, createdAt: '' };
}

const atMs = (climaxTimeMs: number, id = 1) => record(JSON.stringify({ climaxTimeMs, actions: [] }), id);

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

describe('parseClimaxTimeMs', () => {
  it('reads the stored climax position', () => {
    expect(parseClimaxTimeMs(atMs(12_345))).toBe(12_345);
  });

  it('falls back to the last action of a legacy runway array', () => {
    expect(parseClimaxTimeMs(record(JSON.stringify([{ at: 100, pos: 0 }, { at: 900, pos: 50 }])))).toBe(900);
  });

  it('returns null for malformed data', () => {
    expect(parseClimaxTimeMs(record('not json'))).toBeNull();
    expect(parseClimaxTimeMs(record('{}'))).toBeNull();
  });
});

describe('climaxMarkersFrom', () => {
  it('sorts, dedupes and drops unreadable records', () => {
    const markers = climaxMarkersFrom([atMs(30_000, 1), record('bad', 2), atMs(10_000, 3), atMs(30_000, 4)]);
    expect(markers).toEqual([10_000, 30_000]);
  });
});

describe('nextMarker', () => {
  const markers = [10_000, 30_000, THREE_HOURS_MS + 5_000];

  it('finds the first marker ahead', () => {
    expect(nextMarker(markers, 0)).toBe(10_000);
    expect(nextMarker(markers, 12_000)).toBe(30_000);
  });

  it('skips a marker the playhead is sitting on', () => {
    expect(nextMarker(markers, 10_000)).toBe(30_000);
  });

  it('reaches markers past three hours', () => {
    expect(nextMarker(markers, 31_000)).toBe(THREE_HOURS_MS + 5_000);
  });

  it('returns null past the last marker', () => {
    expect(nextMarker(markers, THREE_HOURS_MS + 5_000)).toBeNull();
  });
});

describe('previousMarker', () => {
  const markers = [10_000, 30_000];

  it('returns to the marker just passed', () => {
    expect(previousMarker(markers, 45_000)).toBe(30_000);
  });

  it('walks back past a marker reached moments ago', () => {
    expect(previousMarker(markers, 31_000)).toBe(10_000);
  });

  it('returns null before the first marker', () => {
    expect(previousMarker(markers, 11_000)).toBeNull();
  });
});
