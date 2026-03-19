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
      expect(state.isPaused).toBe(false);
      expect(state.durationMs).toBe(0);
      expect(state.lastError).toBeNull();
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
      expect(result.length).toBeGreaterThan(actions.length);
      const lastAction = result[result.length - 1];
      expect(lastAction.pos).toBe(actions[0].pos);
      expect(result[actions.length].at).toBeGreaterThan(500);
    });

    it('throws on empty actions array', () => {
      expect(() => loop.prepareActions([])).toThrow();
    });
  });

  describe('start', () => {
    function mockUltra(overrides: Partial<Record<string, any>> = {}) {
      return {
        syncScriptUploadFunscriptFile: vi.fn().mockResolvedValue(undefined),
        syncScriptStart: vi.fn().mockResolvedValue(undefined),
        syncScriptStop: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockResolvedValue({
          operationalMode: 'SYNC_SCRIPT_PLAYING',
          syncScriptCurrentTime: 0,
        }),
        ...overrides,
      } as any;
    }

    it('sets isPlaying and durationMs after successful start', async () => {
      const ultra = mockUltra();
      const actions = [
        { pos: 0, at: 0 },
        { pos: 100, at: 2000 },
        { pos: 0, at: 4000 },
      ];

      const result = await loop.start(ultra, actions);

      expect(result.durationMs).toBe(4000);
      expect(loop.getState().isPlaying).toBe(true);
      expect(loop.getState().durationMs).toBe(4000);
      expect(ultra.syncScriptUploadFunscriptFile).toHaveBeenCalledOnce();
      expect(ultra.syncScriptStart).toHaveBeenCalledWith(0);
    });

    it('keeps state clean when upload throws', async () => {
      const ultra = mockUltra({
        syncScriptUploadFunscriptFile: vi.fn().mockRejectedValue(new Error('upload failed')),
      });

      await expect(loop.start(ultra, [{ pos: 0, at: 0 }, { pos: 100, at: 1000 }]))
        .rejects.toThrow('upload failed');

      expect(loop.getState().isPlaying).toBe(false);
      expect(loop.getState().durationMs).toBe(0);
    });

    it('keeps state clean when syncScriptStart throws', async () => {
      const ultra = mockUltra({
        syncScriptStart: vi.fn().mockRejectedValue(new Error('start failed')),
      });

      await expect(loop.start(ultra, [{ pos: 0, at: 0 }, { pos: 100, at: 1000 }]))
        .rejects.toThrow('start failed');

      expect(loop.getState().isPlaying).toBe(false);
      expect(loop.getState().durationMs).toBe(0);
    });
  });

  describe('error propagation', () => {
    it('sets lastError when checkAndRestart encounters device error', async () => {
      const callCount = { n: 0 };
      const ultra = {
        syncScriptUploadFunscriptFile: vi.fn().mockResolvedValue(undefined),
        syncScriptStart: vi.fn().mockResolvedValue(undefined),
        syncScriptStop: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockImplementation(() => {
          callCount.n++;
          if (callCount.n === 1) {
            return Promise.reject(new Error('device timeout'));
          }
          return Promise.resolve({ operationalMode: 'IDLE', syncScriptCurrentTime: 0 });
        }),
      } as any;

      await loop.start(ultra, [{ pos: 0, at: 0 }, { pos: 100, at: 5000 }]);
      expect(loop.getState().isPlaying).toBe(true);

      // Advance past the check point
      await vi.advanceTimersByTimeAsync(5000);

      expect(loop.getState().isPlaying).toBe(false);
      expect(loop.getState().lastError).toBe('device timeout');
    });
  });

  describe('stop during playback', () => {
    it('cancels pending timers and resets state', async () => {
      const ultra = {
        syncScriptUploadFunscriptFile: vi.fn().mockResolvedValue(undefined),
        syncScriptStart: vi.fn().mockResolvedValue(undefined),
        syncScriptStop: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockResolvedValue({
          operationalMode: 'SYNC_SCRIPT_PLAYING',
          syncScriptCurrentTime: 0,
        }),
      } as any;

      await loop.start(ultra, [{ pos: 0, at: 0 }, { pos: 100, at: 10000 }]);
      expect(loop.getState().isPlaying).toBe(true);

      await loop.stop(ultra);

      expect(loop.getState().isPlaying).toBe(false);
      expect(loop.getState().durationMs).toBe(0);
      expect(ultra.syncScriptStop).toHaveBeenCalled();

      // Advancing timers should not cause any callbacks to fire
      ultra.getState.mockClear();
      await vi.advanceTimersByTimeAsync(20000);
      expect(ultra.getState).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('clears all timers and resets state', () => {
      loop.destroy();
      const state = loop.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.durationMs).toBe(0);
      expect(state.lastError).toBeNull();
    });
  });
});
