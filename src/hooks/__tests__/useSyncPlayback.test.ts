// @vitest-environment jsdom

/**
 * Teardown coverage for video-device sync.
 *
 * The upload effect's cleanup shipped dead — it tested `scriptUploaded`, which
 * only flips inside an async upload the effect never re-runs for — so the
 * device was never told to stop on unmount or on a script change. Nothing
 * caught it because no test ever unmounted the hook.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { Funscript } from '@/types/funscript';
import { useSyncPlayback } from '@/hooks/useSyncPlayback';

const FUNSCRIPT: Funscript = { actions: [{ at: 0, pos: 0 }, { at: 1_000, pos: 100 }] };
const OTHER_FUNSCRIPT: Funscript = { actions: [{ at: 0, pos: 50 }, { at: 500, pos: 0 }] };

function mockUltra(overrides: Record<string, unknown> = {}) {
  return {
    syncScriptUploadFunscriptFile: vi.fn().mockResolvedValue(undefined),
    syncScriptStart: vi.fn().mockResolvedValue(undefined),
    syncScriptStop: vi.fn().mockResolvedValue(undefined),
    syncScriptOffset: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue({ syncScriptCurrentTime: 0 }),
    estimateLatency: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as Ultra & Record<string, ReturnType<typeof vi.fn>>;
}

function renderSync(ultra: Ultra, funscript: Funscript | null = FUNSCRIPT) {
  const videoRef = createRef<HTMLVideoElement>();
  return renderHook(
    ({ script }: { script: Funscript | null }) =>
      useSyncPlayback(videoRef, ultra, script, 'blob:video'),
    { initialProps: { script: funscript } },
  );
}

describe('useSyncPlayback teardown', () => {
  // The hook logs upload failures; the failure paths below are deliberate
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('stops the sync script on unmount once the upload has completed', async () => {
    const ultra = mockUltra();
    const { unmount } = renderSync(ultra);

    await waitFor(() => expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalled());
    unmount();

    await waitFor(() => expect(ultra.syncScriptStop).toHaveBeenCalledTimes(1));
  });

  it('stops the previous script when the funscript changes', async () => {
    const ultra = mockUltra();
    const { rerender } = renderSync(ultra);

    await waitFor(() => expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalledTimes(1));
    rerender({ script: OTHER_FUNSCRIPT });

    await waitFor(() => expect(ultra.syncScriptStop).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalledTimes(2));
  });

  it('does not stop a script that was never uploaded', async () => {
    const ultra = mockUltra({
      syncScriptUploadFunscriptFile: vi.fn().mockRejectedValue(new Error('device offline')),
    });
    const { unmount } = renderSync(ultra);

    await waitFor(() => expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalled());
    unmount();

    expect(ultra.syncScriptStop).not.toHaveBeenCalled();
  });

  it('ignores a stale upload rejection that settles after the script changed', async () => {
    // A late rejection writing scriptUploaded=false would re-deaden the cleanup
    let rejectFirst: ((err: Error) => void) | undefined;
    const upload = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
      .mockResolvedValue(undefined);
    const ultra = mockUltra({ syncScriptUploadFunscriptFile: upload });

    const { rerender, unmount } = renderSync(ultra);
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));

    rerender({ script: OTHER_FUNSCRIPT });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));

    // The orphaned first upload only fails now, after the second one succeeded
    rejectFirst?.(new Error('too late'));
    await Promise.resolve();

    unmount();
    await waitFor(() => expect(ultra.syncScriptStop).toHaveBeenCalled());
  });
});
