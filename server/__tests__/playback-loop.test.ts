import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackLoop } from '../services/playback-loop.js';

describe('PlaybackLoop', () => {
  let loop: PlaybackLoop;

  beforeEach(() => {
    vi.useFakeTimers();
    loop = new PlaybackLoop();
  });

  afterEach(() => {
    loop.destroy();
    vi.useRealTimers();
  });

  describe('getState', () => {
    it('returns stopped state initially', () => {
      const state = loop.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.durationMs).toBe(0);
    });
  });

  describe('prepareActions', () => {
    it('returns actions unchanged when first and last pos match', () => {
      const actions = [
        { pos: 0, at: 0 },
        { pos: 100, at: 500 },
        { pos: 0, at: 1000 },
      ];
      const result = loop.prepareActions(actions);
      expect(result).toEqual(actions);
    });

    it('appends smooth transition when first and last pos differ', () => {
      const actions = [
        { pos: 0, at: 0 },
        { pos: 100, at: 500 },
      ];
      const result = loop.prepareActions(actions);
      // Should have extra actions after the original ones
      expect(result.length).toBeGreaterThan(actions.length);
      // Last action should end near the first action's position
      const lastAction = result[result.length - 1];
      expect(lastAction.pos).toBe(actions[0].pos);
      // Transition actions should come after the last original action
      expect(result[actions.length].at).toBeGreaterThan(500);
    });

    it('throws on empty actions array', () => {
      expect(() => loop.prepareActions([])).toThrow();
    });
  });

  describe('destroy', () => {
    it('clears all timers and resets state', () => {
      loop.destroy();
      const state = loop.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.durationMs).toBe(0);
    });
  });
});
