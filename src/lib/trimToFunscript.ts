import { trimCutTargetMs } from '@server/types/shared';
import type { FunscriptAction } from '@/types/funscript';

/**
 * Where "Trim to funscript" would aim to cut the loaded video.
 * @returns the target in milliseconds, or null when the script starts too
 *   early for a trim to be worth offering.
 */
export function trimTargetForActions(actions: FunscriptAction[]): number | null {
  if (actions.length === 0) return null;
  const firstActionMs = actions.reduce((earliest, action) => Math.min(earliest, action.at), Infinity);
  return trimCutTargetMs(firstActionMs);
}
