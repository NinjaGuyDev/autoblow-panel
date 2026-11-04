// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTransportKeys } from '@/hooks/useTransportKeys';
import { LONG_SKIP_STEP_MS, SKIP_STEP_MS, SeekDirection } from '@/lib/transportKeys';

function press(code: string, init: KeyboardEventInit = {}, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function setup(enabled = true) {
  const onTogglePause = vi.fn();
  const onSkip = vi.fn();
  const onClimaxJump = vi.fn();
  const hook = renderHook(() => useTransportKeys({ enabled, onTogglePause, onSkip, onClimaxJump }));
  return { onTogglePause, onSkip, onClimaxJump, ...hook };
}

describe('useTransportKeys', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('toggles pause on Space and prevents the page scroll', () => {
    const { onTogglePause } = setup();
    const event = press('Space');
    expect(onTogglePause).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores held-Space repeats', () => {
    const { onTogglePause } = setup();
    press('Space', { repeat: true });
    expect(onTogglePause).not.toHaveBeenCalled();
  });

  it('skips by the short step on arrows and the long step with Shift', () => {
    const { onSkip } = setup();
    press('ArrowRight');
    expect(onSkip.mock.calls[onSkip.mock.calls.length - 1]).toEqual([SeekDirection.Forward, SKIP_STEP_MS]);
    press('ArrowLeft', { shiftKey: true });
    expect(onSkip.mock.calls[onSkip.mock.calls.length - 1]).toEqual([SeekDirection.Back, LONG_SKIP_STEP_MS]);
  });

  it('jumps between climaxes on [ and ], ignoring key repeat', () => {
    const { onClimaxJump } = setup();
    press('BracketLeft');
    expect(onClimaxJump.mock.calls[onClimaxJump.mock.calls.length - 1]).toEqual([SeekDirection.Back]);
    press('BracketRight');
    expect(onClimaxJump.mock.calls[onClimaxJump.mock.calls.length - 1]).toEqual([SeekDirection.Forward]);
    press('BracketRight', { repeat: true });
    expect(onClimaxJump).toHaveBeenCalledTimes(2);
  });

  it('leaves Space to a focused button', () => {
    const { onTogglePause } = setup();
    const button = document.createElement('button');
    document.body.appendChild(button);
    press('Space', {}, button);
    expect(onTogglePause).not.toHaveBeenCalled();
  });

  it('leaves keys to text inputs', () => {
    const { onSkip } = setup();
    const field = document.createElement('input');
    field.type = 'text';
    document.body.appendChild(field);
    press('ArrowLeft', {}, field);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('skips from a focused slider and cancels its native step', () => {
    const { onSkip } = setup();
    const slider = document.createElement('input');
    slider.type = 'range';
    document.body.appendChild(slider);
    const event = press('ArrowRight', {}, slider);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('stands aside when another handler already took the key', () => {
    const { onSkip } = setup();
    const tab = document.createElement('div');
    document.body.appendChild(tab);
    tab.addEventListener('keydown', e => e.preventDefault());
    press('ArrowRight', {}, tab);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const { onTogglePause, onSkip } = setup(false);
    press('Space');
    press('ArrowRight');
    expect(onTogglePause).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });
});
