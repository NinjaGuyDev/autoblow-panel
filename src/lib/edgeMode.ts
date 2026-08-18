/**
 * Edge mode — a fixed, one-shot slow-down program applied from the current
 * playhead.
 *
 * The script ramps back up through three phases and then returns to original
 * speed on its own, because `buildWarp` plays any un-segmented time at 1x.
 *
 * Phase durations, play windows and pause lengths are all *wall-clock* time —
 * what the user actually experiences. `compileEdgeMode` converts them into the
 * original-script-time segments the warp engine expects, which is where the
 * speed factor comes in: five wall-clock seconds at 0.25x consumes only 1.25
 * seconds of the script.
 */

import type { SpeedSegment } from './timeWarp';

export interface EdgePhase {
  /** Playback speed during this phase, relative to the original script. */
  factor: number;
  /** Wall-clock ms of movement between pauses. */
  playMs: number;
  /** Wall-clock ms held still at each pause. */
  pauseMs: number;
  /** Total wall-clock ms this phase lasts. */
  durationMs: number;
}

/**
 * 2 minutes at quarter speed with 5s pauses, 1 minute at half speed with 2s
 * pauses, 30 seconds at three-quarter speed with 1s pauses, then original speed.
 */
export const EDGE_MODE_PHASES: readonly EdgePhase[] = [
  { factor: 0.25, playMs: 5_000, pauseMs: 5_000, durationMs: 120_000 },
  { factor: 0.5, playMs: 5_000, pauseMs: 2_000, durationMs: 60_000 },
  { factor: 0.75, playMs: 5_000, pauseMs: 1_000, durationMs: 30_000 },
];

/** Total wall-clock length of a phase list — 3m30s for the default program. */
export function edgeModeWallDurationMs(phases: readonly EdgePhase[] = EDGE_MODE_PHASES): number {
  return phases.reduce((total, phase) => total + phase.durationMs, 0);
}

/**
 * Compile the edge program into speed segments in original script time.
 *
 * The program is anchored at `startOriginalMs` and truncated if the script ends
 * first; time after the program carries no segments, so it plays at 1x.
 */
export function compileEdgeMode(
  startOriginalMs: number,
  scriptDurationMs: number,
  phases: readonly EdgePhase[] = EDGE_MODE_PHASES,
): SpeedSegment[] {
  const segments: SpeedSegment[] = [];
  if (scriptDurationMs <= 0) return segments;

  let cursorMs = Math.max(0, Math.min(startOriginalMs, scriptDurationMs));

  for (const phase of phases) {
    let wallRemainingMs = phase.durationMs;

    while (wallRemainingMs > 0 && cursorMs < scriptDurationMs) {
      const playWallMs = Math.min(phase.playMs, wallRemainingMs);
      const playEndMs = Math.min(cursorMs + playWallMs * phase.factor, scriptDurationMs);

      if (playEndMs > cursorMs) {
        segments.push({ startMs: cursorMs, endMs: playEndMs, factor: phase.factor });
        cursorMs = playEndMs;
      }
      wallRemainingMs -= playWallMs;

      // No trailing pause once the phase budget or the script has run out
      if (wallRemainingMs <= 0 || cursorMs >= scriptDurationMs) break;

      const pauseWallMs = Math.min(phase.pauseMs, wallRemainingMs);
      if (pauseWallMs <= 0) break;

      segments.push({ startMs: cursorMs, endMs: cursorMs, factor: 0, pauseDurationMs: pauseWallMs });
      wallRemainingMs -= pauseWallMs;
    }
  }

  return segments;
}

/**
 * Original-script time at which the program hands playback back at 1x.
 * Returns `startOriginalMs` when the program compiles to nothing.
 */
export function edgeModeEndOriginalMs(segments: readonly SpeedSegment[], startOriginalMs: number): number {
  return segments.reduce((end, segment) => Math.max(end, segment.endMs), startOriginalMs);
}
