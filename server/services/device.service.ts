import { deviceInit } from '@xsense/autoblow-sdk';
import type { Ultra } from '@xsense/autoblow-sdk';
import { PlaybackLoop } from './playback-loop.js';
import type { LibraryService } from './library.service.js';
import type {
  DeviceConnectResponse,
  DeviceStatusResponse,
  DevicePlayResponse,
} from '../types/shared.js';

/** Auto-disconnect after 30 minutes of inactivity */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export class DeviceService {
  private ultra: Ultra | null = null;
  private connectionState: 'connected' | 'disconnected' = 'disconnected';
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: string | null = null;
  private playbackLoop: PlaybackLoop;

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

    const result = await deviceInit(deviceKey);

    if (result.deviceType !== 'autoblow-ultra' || !result.ultra) {
      throw new Error('Device connection failed: unsupported device type');
    }

    this.ultra = result.ultra;
    this.connectionState = 'connected';
    this.lastError = null;

    const latencyMs = await this.ultra.estimateLatency();
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

    this.playbackLoop.destroy();
    this.ultra = null;
    this.connectionState = 'disconnected';
    this.lastError = null;
    this.clearInactivityTimer();
  }

  getStatus(): DeviceStatusResponse {
    const loopState = this.playbackLoop.getState();
    return {
      connection: this.connectionState,
      playback: loopState.isPlaying ? 'playing' : 'stopped',
      durationMs: loopState.durationMs,
      looping: loopState.isPlaying,
      lastError: this.lastError ?? loopState.lastError,
    };
  }

  async play(actions: Array<{ pos: number; at: number }>): Promise<DevicePlayResponse> {
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
    const parsed = JSON.parse(item.funscriptData);
    // funscriptData may be { actions: [...], version } or raw array
    const actions: Array<{ pos: number; at: number }> = Array.isArray(parsed)
      ? parsed
      : parsed.actions;

    if (!actions || actions.length === 0) {
      throw new Error('Library item has no funscript actions');
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

  private requireConnection(): void {
    if (this.connectionState !== 'connected' || !this.ultra) {
      throw new Error('No device connected');
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
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}
