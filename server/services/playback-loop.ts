import type { Ultra } from '@xsense/autoblow-sdk';

interface FunscriptAction {
  pos: number;
  at: number;
}

/** Check this far before the expected end to account for timing drift */
const CHECK_EARLY_MS = 500;
/** If the first check is too early, retry after this interval */
const RETRY_INTERVAL_MS = 250;
/** Duration of the smooth transition ramp in ms */
const TRANSITION_DURATION_MS = 300;
/** Number of intermediate points in smooth transition */
const TRANSITION_STEPS = 5;

/**
 * Server-side loop scheduler for continuous pattern playback.
 *
 * Port of the frontend's useDemoLoop hook. Uses setTimeout-based
 * scheduling to check near the end of playback and restart from
 * position 0 for seamless looping.
 */
export class PlaybackLoop {
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private currentActions: FunscriptAction[] | null = null;
  private scriptDurationMs: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private cancelled: boolean = false;
  private lastError: string | null = null;

  getState(): { isPlaying: boolean; isPaused: boolean; durationMs: number; lastError: string | null } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      durationMs: this.scriptDurationMs,
      lastError: this.lastError,
    };
  }

  /**
   * Prepare actions for looping by appending a smooth transition
   * if the last position differs from the first.
   */
  prepareActions(actions: FunscriptAction[]): FunscriptAction[] {
    if (actions.length === 0) {
      throw new Error('Actions array must not be empty');
    }

    const firstPos = actions[0].pos;
    const lastAction = actions[actions.length - 1];

    if (firstPos === lastAction.pos) {
      return actions;
    }

    // Generate smooth linear ramp from lastPos back to firstPos
    const transitionActions: FunscriptAction[] = [];
    for (let i = 1; i <= TRANSITION_STEPS; i++) {
      const t = i / TRANSITION_STEPS;
      const pos = Math.round(lastAction.pos + (firstPos - lastAction.pos) * t);
      const at = lastAction.at + Math.round(TRANSITION_DURATION_MS * t);
      transitionActions.push({ pos, at });
    }

    return [...actions, ...transitionActions];
  }

  /**
   * Start looping playback on the device.
   * Uploads the funscript and begins the loop scheduling cycle.
   */
  async start(ultra: Ultra, actions: FunscriptAction[]): Promise<{ durationMs: number }> {
    // Stop any existing playback before uploading new script
    if (this.isPlaying) {
      await ultra.syncScriptStop();
    }
    this.clearTimer();
    this.cancelled = false;
    this.isPaused = false;
    this.lastError = null;

    const prepared = this.prepareActions(actions);
    this.currentActions = prepared;
    this.scriptDurationMs = prepared[prepared.length - 1].at;

    // Create funscript object and upload
    const funscript = {
      version: '1.0',
      inverted: false,
      range: 100,
      actions: prepared,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ultra.syncScriptUploadFunscriptFile(funscript as any);
    await ultra.syncScriptStart(0);

    this.isPlaying = true;
    this.scheduleCheck(ultra, Date.now());

    return { durationMs: this.scriptDurationMs };
  }

  /**
   * Stop playback and clear all timers.
   */
  async stop(ultra: Ultra): Promise<void> {
    this.cancelled = true;
    this.clearTimer();

    if (this.isPlaying) {
      await ultra.syncScriptStop();
    }

    this.isPlaying = false;
    this.currentActions = null;
    this.scriptDurationMs = 0;
  }

  /**
   * Pause playback — stops the device and loop timer but retains
   * the current pattern so it can be resumed.
   */
  async pause(ultra: Ultra): Promise<void> {
    if (!this.isPlaying || this.isPaused) return;

    this.clearTimer();
    await ultra.syncScriptStop();
    this.isPaused = true;
  }

  /**
   * Resume paused playback — restarts the pattern from the beginning
   * and re-engages the loop scheduler.
   */
  async resume(ultra: Ultra): Promise<void> {
    if (!this.isPlaying || !this.isPaused) return;

    this.isPaused = false;
    this.cancelled = false;
    await ultra.syncScriptStart(0);
    this.scheduleCheck(ultra, Date.now());
  }

  /**
   * Clean up all timers without device communication.
   * Use when disconnecting or shutting down.
   */
  destroy(): void {
    this.cancelled = true;
    this.clearTimer();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentActions = null;
    this.scriptDurationMs = 0;
    this.lastError = null;
  }

  private clearTimer(): void {
    if (this.loopTimer !== null) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private scheduleCheck(ultra: Ultra, cycleStart: number): void {
    if (this.cancelled) return;
    const elapsed = Date.now() - cycleStart;
    const waitMs = Math.max(0, this.scriptDurationMs - CHECK_EARLY_MS - elapsed);
    this.loopTimer = setTimeout(() => this.checkAndRestart(ultra, cycleStart), waitMs);
  }

  private async checkAndRestart(ultra: Ultra, cycleStart: number): Promise<void> {
    if (this.cancelled) return;

    try {
      const state = await ultra.getState();
      const isDevicePlaying = state.operationalMode === 'SYNC_SCRIPT_PLAYING';
      const nearEnd = state.syncScriptCurrentTime >= this.scriptDurationMs - CHECK_EARLY_MS;

      if (nearEnd || !isDevicePlaying) {
        // Restart from beginning
        await ultra.syncScriptStart(0);
        this.scheduleCheck(ultra, Date.now());
      } else {
        // Checked too early — retry shortly
        this.loopTimer = setTimeout(
          () => this.checkAndRestart(ultra, cycleStart),
          RETRY_INTERVAL_MS
        );
      }
    } catch (err) {
      // Device communication error — stop the loop, surface via getState().lastError
      this.isPlaying = false;
      this.lastError = err instanceof Error ? err.message : 'Device communication error during playback loop';
    }
  }
}
