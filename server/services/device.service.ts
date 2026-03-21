import { deviceInit } from '@xsense/autoblow-sdk';
import type { Ultra } from '@xsense/autoblow-sdk';
import { PlaybackLoop } from './playback-loop.js';
import type { LibraryService } from './library.service.js';
import type {
  FunscriptActionDto,
  DeviceConnectResponse,
  DeviceStatusResponse,
  DevicePlayResponse,
} from '../types/shared.js';
import { ValidationError } from '../errors/domain-errors.js';

/** Auto-disconnect after 30 minutes of inactivity */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export class DeviceService {
  private ultra: Ultra | null = null;
  private connectionState: 'connected' | 'disconnected' = 'disconnected';
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: string | null = null;
  private playbackLoop: PlaybackLoop;
  private pauseButtonHandler: (() => void) | null = null;

  constructor(private libraryService: LibraryService) {
    this.playbackLoop = new PlaybackLoop();
  }

  async connect(deviceKey: string): Promise<DeviceConnectResponse> {
    // Idempotent: if already connected, return current state
    if (this.ultra && this.connectionState === 'connected') {
      const latencyMs = await this.ultra.estimateLatency();
      this.resetInactivityTimer();
      return { status: 'connected', latencyMs };
    }

    // Wrap SDK calls so all failures surface as "Device connection failed: ..."
    let result;
    try {
      result = await deviceInit(deviceKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown device error';
      throw new Error(`Device connection failed: ${msg}`);
    }

    if (result.deviceType !== 'autoblow-ultra' || !result.ultra) {
      throw new Error('Device connection failed: unsupported device type');
    }

    this.ultra = result.ultra;
    this.connectionState = 'connected';
    this.lastError = null;

    // Fresh PlaybackLoop for the new connection (previous may have been destroyed)
    this.playbackLoop = new PlaybackLoop();

    let latencyMs: number;
    try {
      latencyMs = await this.ultra.estimateLatency();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown device error';
      throw new Error(`Device connection failed: ${msg}`);
    }

    this.subscribeToButtonEvents();
    this.resetInactivityTimer();

    return { status: 'connected', latencyMs };
  }

  async disconnect(): Promise<void> {
    // Idempotent: no-op if already disconnected
    if (this.connectionState === 'disconnected') return;

    // Stop any active playback
    if (this.ultra && this.playbackLoop.getState().isPlaying) {
      try {
        await this.playbackLoop.stop(this.ultra);
      } catch {
        // Best-effort stop during disconnect
      }
    }

    this.unsubscribeFromButtonEvents();
    this.playbackLoop.destroy();
    this.ultra = null;
    this.connectionState = 'disconnected';
    this.lastError = null;
    this.clearInactivityTimer();
  }

  getStatus(): DeviceStatusResponse {
    const loopState = this.playbackLoop.getState();
    let playback: 'playing' | 'paused' | 'stopped' = 'stopped';
    if (loopState.isPlaying) {
      playback = loopState.isPaused ? 'paused' : 'playing';
    }
    return {
      connection: this.connectionState,
      playback,
      durationMs: loopState.durationMs,
      looping: loopState.isPlaying && !loopState.isPaused,
      lastError: this.lastError ?? loopState.lastError,
    };
  }

  async play(actions: FunscriptActionDto[]): Promise<DevicePlayResponse> {
    this.requireConnection();
    this.lastError = null;

    try {
      const result = await this.playbackLoop.start(this.ultra!, actions);
      this.resetInactivityTimer();
      return { status: 'playing', durationMs: result.durationMs };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Playback failed';
      throw err;
    }
  }

  async playById(id: number): Promise<DevicePlayResponse> {
    this.requireConnection();
    this.lastError = null;

    const item = this.libraryService.getItemById(id);

    let parsed: unknown;
    try {
      parsed = JSON.parse(item.funscriptData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown parse error';
      throw new Error(`Failed to parse funscriptData for library item ${id}: ${msg}`);
    }

    // funscriptData may be { actions: [...], version } or raw array
    const actions: FunscriptActionDto[] = Array.isArray(parsed)
      ? parsed
      : (parsed as any).actions;

    if (!actions || actions.length === 0) {
      throw new ValidationError('Library item has no funscript actions');
    }

    try {
      const result = await this.playbackLoop.start(this.ultra!, actions);
      this.resetInactivityTimer();
      return {
        status: 'playing',
        durationMs: result.durationMs,
        name: item.funscriptName ?? item.videoName ?? `Item #${item.id}`,
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Playback failed';
      throw err;
    }
  }

  async stop(): Promise<void> {
    // Idempotent: no-op if not playing
    if (!this.ultra || !this.playbackLoop.getState().isPlaying) return;

    try {
      await this.playbackLoop.stop(this.ultra);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Stop failed';
      throw err;
    }
    this.resetInactivityTimer();
  }

  async pause(): Promise<void> {
    if (!this.ultra || !this.playbackLoop.getState().isPlaying) return;
    await this.playbackLoop.pause(this.ultra);
    this.resetInactivityTimer();
  }

  async resume(): Promise<void> {
    if (!this.ultra || !this.playbackLoop.getState().isPaused) return;
    await this.playbackLoop.resume(this.ultra);
    this.resetInactivityTimer();
  }

  async togglePause(): Promise<'paused' | 'resumed' | 'no-op'> {
    const state = this.playbackLoop.getState();
    if (!this.ultra || !state.isPlaying) return 'no-op';

    if (state.isPaused) {
      await this.resume();
      return 'resumed';
    } else {
      await this.pause();
      return 'paused';
    }
  }

  private subscribeToButtonEvents(): void {
    if (!this.ultra) return;

    this.pauseButtonHandler = () => {
      console.log('[DeviceService] Pause button pressed');
      this.togglePause().catch((err) => {
        console.warn('[DeviceService] Toggle pause failed:', err);
      });
    };

    this.ultra.deviceEvents.addEventListener('pause-button-pressed', this.pauseButtonHandler);
  }

  private unsubscribeFromButtonEvents(): void {
    if (this.ultra && this.pauseButtonHandler) {
      this.ultra.deviceEvents.removeEventListener('pause-button-pressed', this.pauseButtonHandler);
    }
    this.pauseButtonHandler = null;
  }

  private requireConnection(): void {
    if (this.connectionState !== 'connected' || !this.ultra) {
      throw new ValidationError('No device connected');
    }
  }

  private resetInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      console.log('[DeviceService] Inactivity timeout — auto-disconnecting');
      this.disconnect().catch((err) => {
        console.warn('[DeviceService] Auto-disconnect failed:', err);
      });
    }, INACTIVITY_TIMEOUT_MS);
    // Don't block graceful shutdown
    this.inactivityTimer?.unref?.();
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}
