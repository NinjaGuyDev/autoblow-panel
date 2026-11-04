// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSeekController } from '@/hooks/useSeekController';
import { LONG_SKIP_STEP_MS, SKIP_STEP_MS, SeekDirection } from '@/lib/transportKeys';

const THREE_HOURS_TEN_MS = (3 * 60 + 10) * 60 * 1000;

function setup(currentTimeMs = 60_000, durationMs = 120_000) {
  const onSeek = vi.fn<(timeMs: number) => Promise<void>>().mockResolvedValue(undefined);
  const hook = renderHook(
    (props: { currentTimeMs: number }) =>
      useSeekController({ currentTimeMs: props.currentTimeMs, durationMs, onSeek }),
    { initialProps: { currentTimeMs } },
  );
  return { onSeek, ...hook };
}

describe('useSeekController', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows live time when nothing is pending', () => {
    const { result } = setup(42_000);
    expect(result.current.displayTimeMs).toBe(42_000);
    expect(result.current.isSeeking).toBe(false);
  });

  it('previews a scrub without seeking, then seeks once on commit', async () => {
    const { result, onSeek } = setup();
    act(() => { result.current.scrubTo(10_000); });
    act(() => { result.current.scrubTo(15_000); });
    expect(result.current.displayTimeMs).toBe(15_000);
    expect(onSeek).not.toHaveBeenCalled();

    await act(async () => { result.current.commitScrub(); });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls[onSeek.mock.calls.length - 1]![0]).toBe(15_000);
    expect(result.current.isSeeking).toBe(false);
  });

  it('coalesces a run of skips into one seek', async () => {
    const { result, onSeek } = setup(60_000);
    act(() => {
      result.current.skip(SeekDirection.Forward, SKIP_STEP_MS);
      result.current.skip(SeekDirection.Forward, SKIP_STEP_MS);
      result.current.skip(SeekDirection.Forward, SKIP_STEP_MS);
    });
    expect(result.current.displayTimeMs).toBe(90_000);
    expect(onSeek).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls[onSeek.mock.calls.length - 1]![0]).toBe(90_000);
  });

  it('clamps scrubs and skips to the script', () => {
    const { result } = setup(115_000, 120_000);
    act(() => { result.current.skip(SeekDirection.Forward, SKIP_STEP_MS); });
    expect(result.current.displayTimeMs).toBe(120_000);
    act(() => { result.current.scrubTo(-500); });
    expect(result.current.displayTimeMs).toBe(0);
  });

  it('seeks to exact positions in a script over three hours long', async () => {
    const { result, onSeek } = setup(THREE_HOURS_TEN_MS - 90_000, THREE_HOURS_TEN_MS);
    act(() => { result.current.skip(SeekDirection.Back, LONG_SKIP_STEP_MS); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(onSeek.mock.calls[onSeek.mock.calls.length - 1]![0]).toBe(THREE_HOURS_TEN_MS - 150_000);

    act(() => { result.current.scrubTo(THREE_HOURS_TEN_MS); });
    await act(async () => { result.current.commitScrub(); });
    expect(onSeek.mock.calls[onSeek.mock.calls.length - 1]![0]).toBe(THREE_HOURS_TEN_MS);
  });

  it('jumps straight to a position, dropping a queued skip', async () => {
    const { result, onSeek } = setup(60_000);
    act(() => { result.current.skip(SeekDirection.Forward, SKIP_STEP_MS); });
    await act(async () => { result.current.jumpTo(5_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls[onSeek.mock.calls.length - 1]![0]).toBe(5_000);
  });

  it('keeps a newer target that arrives while a seek is in flight', async () => {
    let resolveSeek!: () => void;
    const { result, onSeek } = setup();
    onSeek.mockImplementationOnce(() => new Promise<void>(resolve => { resolveSeek = resolve; }));

    act(() => { result.current.scrubTo(10_000); });
    act(() => { result.current.commitScrub(); });
    act(() => { result.current.scrubTo(20_000); });
    await act(async () => { resolveSeek(); });

    expect(result.current.displayTimeMs).toBe(20_000);
    expect(result.current.isSeeking).toBe(true);
  });
});
