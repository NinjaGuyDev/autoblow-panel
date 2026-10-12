/** A video keyframe packet: when it is shown, and a hash of its bytes */
export interface KeyframePacket {
  ptsSeconds: number;
  dataHash: string;
}

/** Allowance for the microsecond rounding in ffprobe's printed timestamps */
const PTS_TOLERANCE_SECONDS = 0.0015;

/**
 * The keyframe a cut aiming at targetSeconds should start from.
 * @returns the latest keyframe at or before the target, or null when there is none.
 */
export function latestKeyframeAtOrBefore(keyframes: KeyframePacket[], targetSeconds: number): KeyframePacket | null {
  return keyframes.reduce<KeyframePacket | null>((latest, keyframe) => {
    if (keyframe.ptsSeconds > targetSeconds + PTS_TOLERANCE_SECONDS) return latest;
    return latest === null || keyframe.ptsSeconds > latest.ptsSeconds ? keyframe : latest;
  }, null);
}

/**
 * How far a stream-copy cut moved the timeline, measured rather than assumed.
 *
 * Demuxers do not all seek to the keyframe they are asked for (Matroska can
 * land a whole GOP early), but stream copy keeps packet bytes intact, so the
 * output's first keyframe is found in the source by its hash. When identical
 * keyframes repeat (a black intro), the latest one at or before the requested
 * start is taken.
 *
 * @returns source time minus output time for the same frame, in seconds, or
 *   null when the output's first keyframe matches no source keyframe.
 */
export function measureCutOffsetSeconds(
  sourceKeyframes: KeyframePacket[],
  outputFirstKeyframe: KeyframePacket,
  requestedStartSeconds: number,
): number | null {
  const matching = sourceKeyframes.filter(keyframe => keyframe.dataHash === outputFirstKeyframe.dataHash);
  const source = latestKeyframeAtOrBefore(matching, requestedStartSeconds);
  return source === null ? null : source.ptsSeconds - outputFirstKeyframe.ptsSeconds;
}
