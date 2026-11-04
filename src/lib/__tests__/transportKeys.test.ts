import { describe, it, expect } from 'vitest';
import {
  LONG_SKIP_STEP_MS,
  SKIP_STEP_MS,
  SeekDirection,
  TransportCommand,
  skipStepMs,
  skipTarget,
  transportCommandFromKey,
} from '@/lib/transportKeys';

const THREE_AND_A_HALF_HOURS_MS = 3.5 * 60 * 60 * 1000;

describe('transportCommandFromKey', () => {
  it.each([
    ['Space', TransportCommand.TogglePause],
    ['KeyK', TransportCommand.TogglePause],
    ['ArrowLeft', TransportCommand.SkipBack],
    ['KeyJ', TransportCommand.SkipBack],
    ['ArrowRight', TransportCommand.SkipForward],
    ['KeyL', TransportCommand.SkipForward],
    ['BracketLeft', TransportCommand.PreviousClimax],
    ['BracketRight', TransportCommand.NextClimax],
  ])('maps %s to %s', (code, command) => {
    expect(transportCommandFromKey(code)).toBe(command);
  });

  it('ignores the speed-control and edge-mode keys', () => {
    expect(transportCommandFromKey('Numpad5')).toBeNull();
    expect(transportCommandFromKey('Digit5')).toBeNull();
    expect(transportCommandFromKey('KeyE')).toBeNull();
  });
});

describe('skipStepMs', () => {
  it('uses the long skip only with Shift', () => {
    expect(skipStepMs(false)).toBe(SKIP_STEP_MS);
    expect(skipStepMs(true)).toBe(LONG_SKIP_STEP_MS);
  });
});

describe('skipTarget', () => {
  it('moves by the step in the given direction', () => {
    expect(skipTarget(30_000, 60_000, SeekDirection.Forward, SKIP_STEP_MS)).toBe(40_000);
    expect(skipTarget(30_000, 60_000, SeekDirection.Back, SKIP_STEP_MS)).toBe(20_000);
  });

  it('clamps to the start and end of the script', () => {
    expect(skipTarget(4_000, 60_000, SeekDirection.Back, SKIP_STEP_MS)).toBe(0);
    expect(skipTarget(55_000, 60_000, SeekDirection.Forward, SKIP_STEP_MS)).toBe(60_000);
  });

  it('stays exact deep into a multi-hour script', () => {
    const nearEnd = THREE_AND_A_HALF_HOURS_MS - 30_000;
    expect(skipTarget(nearEnd, THREE_AND_A_HALF_HOURS_MS, SeekDirection.Back, LONG_SKIP_STEP_MS))
      .toBe(nearEnd - LONG_SKIP_STEP_MS);
    expect(skipTarget(nearEnd, THREE_AND_A_HALF_HOURS_MS, SeekDirection.Forward, LONG_SKIP_STEP_MS))
      .toBe(THREE_AND_A_HALF_HOURS_MS);
  });
});
