// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ClimaxRecord } from '@server/types/shared';
import { useClimaxMarkers } from '@/hooks/useClimaxMarkers';

function recordAt(climaxTimeMs: number, id: number): ClimaxRecord {
  return {
    id,
    sessionId: null,
    timestamp: '',
    runwayData: JSON.stringify({ climaxTimeMs, actions: [] }),
    libraryItemId: 1,
    createdAt: '',
  };
}

describe('useClimaxMarkers', () => {
  it('loads sorted markers for the script', async () => {
    const fetchRecords = vi.fn().mockResolvedValue([recordAt(20_000, 1), recordAt(5_000, 2)]);
    const { result } = renderHook(() => useClimaxMarkers({ libraryItemId: 1, revision: 0, fetchRecords }));

    await waitFor(() => expect(result.current).toEqual([5_000, 20_000]));
    expect(fetchRecords.mock.calls[fetchRecords.mock.calls.length - 1]![0]).toBe(1);
  });

  it('reloads when the revision changes', async () => {
    const fetchRecords = vi.fn()
      .mockResolvedValueOnce([recordAt(5_000, 1)])
      .mockResolvedValueOnce([recordAt(5_000, 1), recordAt(9_000, 2)]);
    const { result, rerender } = renderHook(
      (props: { revision: number }) => useClimaxMarkers({ libraryItemId: 1, revision: props.revision, fetchRecords }),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(result.current).toEqual([5_000]));

    rerender({ revision: 1 });
    await waitFor(() => expect(result.current).toEqual([5_000, 9_000]));
  });

  it('hides the previous script\'s markers until the new ones load', async () => {
    let resolveSecond!: (records: ClimaxRecord[]) => void;
    const fetchRecords = vi.fn()
      .mockResolvedValueOnce([recordAt(5_000, 1)])
      .mockImplementationOnce(() => new Promise<ClimaxRecord[]>(resolve => { resolveSecond = resolve; }));
    const { result, rerender } = renderHook(
      (props: { id: number }) => useClimaxMarkers({ libraryItemId: props.id, revision: 0, fetchRecords }),
      { initialProps: { id: 1 } },
    );
    await waitFor(() => expect(result.current).toEqual([5_000]));

    rerender({ id: 2 });
    expect(result.current).toEqual([]);
    resolveSecond([recordAt(7_000, 3)]);
    await waitFor(() => expect(result.current).toEqual([7_000]));
  });

  it('yields no markers when loading fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchRecords = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useClimaxMarkers({ libraryItemId: 1, revision: 0, fetchRecords }));

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(result.current).toEqual([]);
    error.mockRestore();
  });
});
