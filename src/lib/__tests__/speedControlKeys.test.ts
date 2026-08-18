import { describe, it, expect } from 'vitest';
import { formatSpeedFactor, isEdgeModeKey, speedControlDigit, speedFactorFromKey } from '../speedControlKeys';

describe('speedControlDigit', () => {
  it('reads numpad codes', () => {
    expect(speedControlDigit('Numpad0')).toBe(0);
    expect(speedControlDigit('Numpad7')).toBe(7);
  });

  it('falls back to the top-row digits', () => {
    expect(speedControlDigit('Digit3')).toBe(3);
  });

  it('ignores everything else', () => {
    for (const code of ['KeyA', 'Space', 'NumpadAdd', 'Numpad10', 'Digit', 'ArrowUp', '']) {
      expect(speedControlDigit(code)).toBeNull();
    }
  });
});

describe('speedFactorFromKey', () => {
  it('speeds up by 10% per digit', () => {
    expect(speedFactorFromKey('Numpad1', false)).toBe(1.1);
    expect(speedFactorFromKey('Numpad3', false)).toBe(1.3);
    expect(speedFactorFromKey('Numpad9', false)).toBe(1.9);
  });

  it('slows down by 10% per digit with shift', () => {
    expect(speedFactorFromKey('Numpad1', true)).toBe(0.9);
    expect(speedFactorFromKey('Numpad3', true)).toBe(0.7);
    expect(speedFactorFromKey('Numpad9', true)).toBe(0.1);
  });

  it('restores original speed on 0, with or without shift', () => {
    expect(speedFactorFromKey('Numpad0', false)).toBe(1);
    expect(speedFactorFromKey('Numpad0', true)).toBe(1);
  });

  it('is driven by code, not key — Shift+Numpad1 reports key "End"', () => {
    // The event this simulates is { key: 'End', code: 'Numpad1', shiftKey: true }
    expect(speedFactorFromKey('Numpad1', true)).toBe(0.9);
    expect(speedFactorFromKey('End', true)).toBeNull();
  });

  it('never produces floating-point artefacts', () => {
    for (let digit = 0; digit <= 9; digit++) {
      for (const shift of [false, true]) {
        const factor = speedFactorFromKey(`Numpad${digit}`, shift);
        expect(factor).not.toBeNull();
        expect(Math.round(factor! * 100) / 100).toBe(factor);
      }
    }
  });

  it('returns null for non-speed keys', () => {
    expect(speedFactorFromKey('KeyK', false)).toBeNull();
  });
});

describe('formatSpeedFactor', () => {
  it('labels increases and decreases', () => {
    expect(formatSpeedFactor(1.4)).toBe('×1.4 (+40%)');
    expect(formatSpeedFactor(0.7)).toBe('×0.7 (−30%)');
    expect(formatSpeedFactor(1)).toBe('×1 (0%)');
    expect(formatSpeedFactor(2)).toBe('×2 (+100%)');
  });
});

describe('isEdgeModeKey', () => {
  it('matches the e key', () => {
    expect(isEdgeModeKey('KeyE')).toBe(true);
  });

  it('ignores other letter keys', () => {
    expect(isEdgeModeKey('KeyF')).toBe(false);
    expect(isEdgeModeKey('KeyQ')).toBe(false);
  });

  it('does not collide with the speed digits', () => {
    expect(isEdgeModeKey('Numpad3')).toBe(false);
    expect(speedFactorFromKey('KeyE', false)).toBeNull();
  });
});
