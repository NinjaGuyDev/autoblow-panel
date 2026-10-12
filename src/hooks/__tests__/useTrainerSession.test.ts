// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { TrainerPattern } from '@server/types/shared';
import { useTrainerSession } from '@/hooks/useTrainerSession';

/** Short patterns keep each pass (and so each test) around a second long. */
function trainerPattern(id: number, rankCount = 0): TrainerPattern {
  return {
    id,
    patternKey: `src@${id}`,
    name: `Pattern ${id}`,
    sourceLabel: 'src',
    familyKey: 'A',
    variation: id,
    actions: [{ at: 0, pos: 0 }, { at: 600, pos: 100 }],
    durationMs: 600,
    intensity: 'low',
    tags: [],
    averageRank: null,
    rankCount,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockUltra() {
  return {
    syncScriptUploadFunscriptFile: vi.fn().mockResolvedValue(undefined),
    syncScriptStart: vi.fn().mockResolvedValue(undefined),
    syncScriptStop: vi.fn().mockResolvedValue(undefined),
    // Always report the end of the script, so every loop check fires straight away
    getState: vi.fn().mockResolvedValue({ operationalMode: 'SYNC_SCRIPT_PLAYING', syncScriptCurrentTime: 1e9 }),
  } as unknown as Ultra & Record<string, ReturnType<typeof vi.fn>>;
}

const PATTERNS = [trainerPattern(1), trainerPattern(2)];

/** A promise the test settles by hand, to hold a device call in flight. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

/** Make the second upload (the switch to a new pattern) wait until the test releases it. */
function holdSwitchUpload(ultra: ReturnType<typeof mockUltra>) {
  const upload = deferred();
  (ultra.syncScriptUploadFunscriptFile as unknown as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce(undefined)
    .mockReturnValueOnce(upload.promise);
  return upload;
}

function lastCallOrder(mock: unknown): number {
  const order = vi.mocked(mock as ReturnType<typeof vi.fn>).mock.invocationCallOrder;
  return order[order.length - 1] ?? 0;
}

function renderSession(ultra: Ultra, recordRank = vi.fn(async (id: number) => ({ ...trainerPattern(id, 1), averageRank: 5 }))) {
  const hook = renderHook(() => useTrainerSession({ ultra, patterns: PATTERNS, recordRank }));
  return { ...hook, recordRank };
}

describe('useTrainerSession', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('repeats the pattern until it is ranked', async () => {
    const ultra = mockUltra();
    const { result, recordRank } = renderSession(ultra);

    await act(() => result.current.start());
    const firstId = result.current.currentPattern!.id;

    await waitFor(() => expect(result.current.passCount).toBe(2), { timeout: 3_000 });
    expect(result.current.currentPattern!.id).toBe(firstId);
    expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalledTimes(1);
    expect(recordRank).not.toHaveBeenCalled();
  });

  it('saves the latest rank and switches pattern once the pass finishes', async () => {
    const ultra = mockUltra();
    const { result, recordRank } = renderSession(ultra);

    await act(() => result.current.start());
    const firstId = result.current.currentPattern!.id;
    act(() => { result.current.rank(3); });
    act(() => { result.current.rank(8); });
    expect(result.current.pendingRank).toBe(8);

    await waitFor(() => expect(result.current.currentPattern!.id).not.toBe(firstId), { timeout: 3_000 });
    expect(recordRank).toHaveBeenCalledExactlyOnceWith(firstId, 8);
    expect(result.current.pendingRank).toBeNull();

    // The new loop leads in from where the previous one came to rest (its start, 0)
    const secondUpload = vi.mocked(ultra.syncScriptUploadFunscriptFile).mock.calls[1]![0];
    expect(secondUpload.actions[0]).toEqual({ at: 0, pos: 0 });
  });

  it('saves a pending rank and stops the device on stop', async () => {
    const ultra = mockUltra();
    const { result, recordRank } = renderSession(ultra);

    await act(() => result.current.start());
    const id = result.current.currentPattern!.id;
    act(() => { result.current.rank(0); });
    await act(() => result.current.stop());

    expect(recordRank).toHaveBeenCalledExactlyOnceWith(id, 0);
    expect(ultra.syncScriptStop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.currentPattern).toBeNull();
  });

  it('drops a rank entered while switching instead of saving it for the next pattern', async () => {
    const ultra = mockUltra();
    const upload = holdSwitchUpload(ultra);
    const { result, recordRank } = renderSession(ultra);

    await act(() => result.current.start());
    const firstId = result.current.currentPattern!.id;
    act(() => { result.current.rank(7); });
    await waitFor(() => expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalledTimes(2), { timeout: 3_000 });

    act(() => { result.current.rank(4); });
    await act(async () => { upload.resolve(); });

    await waitFor(() => expect(result.current.currentPattern!.id).not.toBe(firstId));
    expect(result.current.pendingRank).toBeNull();
    // Let the new pattern finish a pass: unranked, it repeats rather than saving anything
    await waitFor(() => expect(result.current.passCount).toBe(2), { timeout: 3_000 });
    expect(recordRank).toHaveBeenCalledExactlyOnceWith(firstId, 7);
  });

  it('never starts the device after a stop pressed mid-switch', async () => {
    const ultra = mockUltra();
    const upload = holdSwitchUpload(ultra);
    const { result } = renderSession(ultra);

    await act(() => result.current.start());
    act(() => { result.current.rank(7); });
    await waitFor(() => expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalledTimes(2), { timeout: 3_000 });

    let stopping!: Promise<void>;
    act(() => { stopping = result.current.stop(); });
    await act(async () => { upload.resolve(); await stopping; });

    expect(ultra.syncScriptStart).toHaveBeenCalledTimes(1);
    expect(lastCallOrder(ultra.syncScriptStop)).toBeGreaterThan(lastCallOrder(ultra.syncScriptStart));
    expect(result.current.status).toBe('idle');
  });

  it('keeps a session started after a mid-switch stop running', async () => {
    const ultra = mockUltra();
    const upload = holdSwitchUpload(ultra);
    const { result } = renderSession(ultra);

    await act(() => result.current.start());
    act(() => { result.current.rank(7); });
    await waitFor(() => expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalledTimes(2), { timeout: 3_000 });

    let stopping!: Promise<void>;
    act(() => { stopping = result.current.stop(); });
    // Start is refused until the stop has finished
    await act(() => result.current.start());
    expect(result.current.status).toBe('stopping');

    await act(async () => { upload.resolve(); await stopping; });
    await act(() => result.current.start());

    expect(result.current.status).toBe('playing');
    expect(lastCallOrder(ultra.syncScriptStart)).toBeGreaterThan(lastCallOrder(ultra.syncScriptStop));
  });

  it('ignores ranks while not training', () => {
    const { result } = renderSession(mockUltra());
    act(() => { result.current.rank(5); });
    expect(result.current.pendingRank).toBeNull();
  });

  it('stops the device when the page unmounts mid-session', async () => {
    const ultra = mockUltra();
    const { result, unmount } = renderSession(ultra);

    await act(() => result.current.start());
    unmount();

    await waitFor(() => expect(ultra.syncScriptStop).toHaveBeenCalledTimes(1));
  });
});
