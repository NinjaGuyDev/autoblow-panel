import type { FunscriptDocument } from '../schemas/media.schemas.js';

/**
 * Move a script earlier by the length cut from the start of its video, so
 * every action still lands on the same frame.
 *
 * Actions are copied with their extra fields intact, and a numeric
 * `metadata.duration` (seconds) shrinks by the same amount. Every other field
 * is carried through unchanged.
 *
 * @param cutMs milliseconds removed from the video; must not pass the first action.
 * @throws RangeError when cutMs is negative or later than the first action.
 */
export function shiftFunscriptStart(funscript: FunscriptDocument, cutMs: number): FunscriptDocument {
  const firstActionMs = earliestActionMs(funscript);
  if (cutMs < 0 || cutMs > firstActionMs) {
    throw new RangeError(`Cannot cut ${cutMs} ms from a script whose first action is at ${firstActionMs} ms`);
  }

  const shifted: FunscriptDocument = {
    ...funscript,
    actions: funscript.actions.map(action => ({ ...action, at: action.at - cutMs })),
  };
  if (funscript.metadata && typeof funscript.metadata.duration === 'number') {
    shifted.metadata = {
      ...funscript.metadata,
      duration: Math.max(0, Math.round(funscript.metadata.duration - cutMs / 1000)),
    };
  }
  return shifted;
}

/** Time of the script's earliest action; scripts are not guaranteed to be sorted */
export function earliestActionMs(funscript: FunscriptDocument): number {
  return funscript.actions.reduce((earliest, action) => Math.min(earliest, action.at), Infinity);
}
