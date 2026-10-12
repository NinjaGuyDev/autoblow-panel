// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Ultra } from '@xsense/autoblow-sdk';
import { useScriptLoop } from '@/hooks/useScriptLoop';

const DURATION_MS = 2_000;

/** A device that reports it is still playing, 300 ms short of the script's end. */
function ultraJustBeforeEnd() {
  return {
    getState: vi.fn().mockResolvedValue({ operationalMode: 'SYNC_SCRIPT_PLAYING', syncScriptCurrentTime: DURATION_MS - 300 }),
  } as unknown as Ultra;
}

describe('useScriptLoop', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('reports the loop end up to 500 ms early by default', async () => {
    const onLoopEnd = vi.fn();
    renderHook(() => useScriptLoop(ultraJustBeforeEnd(), true, DURATION_MS, onLoopEnd));

    await vi.advanceTimersByTimeAsync(DURATION_MS - 500);
    expect(onLoopEnd).toHaveBeenCalledTimes(1);
  });

  it('waits for the script to reach its end when checkEarlyMs is 0', async () => {
    const onLoopEnd = vi.fn();
    renderHook(() => useScriptLoop(ultraJustBeforeEnd(), true, DURATION_MS, onLoopEnd, 0));

    await vi.advanceTimersByTimeAsync(DURATION_MS + 1_000);
    expect(onLoopEnd).not.toHaveBeenCalled();
  });
});
