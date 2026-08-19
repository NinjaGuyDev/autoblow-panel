// @vitest-environment jsdom

/**
 * Teardown coverage for manual control.
 *
 * The unmount cleanup shipped dead — it tested state captured at mount — and
 * nothing noticed because no test ever unmounted the hook. Starting a pattern
 * and navigating away left the physical device running, so these assertions
 * guard the cleanup against going stale again.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Ultra } from '@xsense/autoblow-sdk';
import { useManualControl } from '@/hooks/useManualControl';

function mockUltra(overrides: Record<string, unknown> = {}) {
  return {
    oscillateSet: vi.fn().mockResolvedValue(undefined),
    oscillateStart: vi.fn().mockResolvedValue(undefined),
    oscillateStop: vi.fn().mockResolvedValue(undefined),
    syncScriptUploadFunscriptFile: vi.fn().mockResolvedValue(undefined),
    syncScriptStart: vi.fn().mockResolvedValue(undefined),
    syncScriptStop: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Ultra & Record<string, ReturnType<typeof vi.fn>>;
}

describe('useManualControl teardown', () => {
  it('stops oscillation on unmount while running', async () => {
    const ultra = mockUltra();
    const { result, unmount } = renderHook(() => useManualControl(ultra));

    await act(async () => { result.current.start(); });
    await waitFor(() => expect(result.current.isRunning).toBe(true));

    unmount();

    await waitFor(() => expect(ultra.oscillateStop).toHaveBeenCalledTimes(1));
  });

  it('stops the device when the unmount lands mid start round trip', async () => {
    // isRunning only flips after the start command resolves, so the ref has to
    // be set when the command is issued or this window leaks a running device
    let releaseStart: (() => void) | undefined;
    const ultra = mockUltra({
      oscillateStart: vi.fn(() => new Promise<void>(resolve => { releaseStart = () => resolve(); })),
    });

    const { result, unmount } = renderHook(() => useManualControl(ultra));

    await act(async () => { result.current.start(); });
    expect(result.current.isRunning).toBe(false);

    unmount();
    releaseStart?.();

    await waitFor(() => expect(ultra.oscillateStop).toHaveBeenCalledTimes(1));
  });

  it('leaves the device alone on unmount when nothing was started', () => {
    const ultra = mockUltra();
    const { unmount } = renderHook(() => useManualControl(ultra));

    unmount();

    expect(ultra.oscillateStop).not.toHaveBeenCalled();
  });

  it('does not stop again after an explicit stop', async () => {
    const ultra = mockUltra();
    const { result, unmount } = renderHook(() => useManualControl(ultra));

    await act(async () => { result.current.start(); });
    await waitFor(() => expect(result.current.isRunning).toBe(true));
    await act(async () => { result.current.stop(); });
    await waitFor(() => expect(ultra.oscillateStop).toHaveBeenCalledTimes(1));

    unmount();

    expect(ultra.oscillateStop).toHaveBeenCalledTimes(1);
  });
});
