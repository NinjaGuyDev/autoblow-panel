/** A video keyframe packet: when it is shown, and a hash of its bytes */
export interface KeyframePacket {
  ptsSeconds: number;
  dataHash: string;
}

/** What matching the output's first keyframe back to the source found */
export type CutMeasurement =
  | { status: 'matched'; offsetSeconds: number }
  /** No source keyframe at or before the requested start has the output's hash */
  | { status: 'unmatched' }
  /** Several identical source keyframes could be the start, so the offset is unknown */
  | { status: 'ambiguous' };

/** Allowance for the microsecond rounding in ffprobe's printed timestamps */
const PTS_TOLERANCE_SECONDS = 0.0015;

function atOrBefore(keyframes: KeyframePacket[], targetSeconds: number): KeyframePacket[] {
  return keyframes.filter(keyframe => keyframe.ptsSeconds <= targetSeconds + PTS_TOLERANCE_SECONDS);
}

function latest(keyframes: KeyframePacket[]): KeyframePacket | null {
  return keyframes.reduce<KeyframePacket | null>(
    (found, keyframe) => (found === null || keyframe.ptsSeconds > found.ptsSeconds ? keyframe : found),
    null,
  );
}

/**
 * The keyframe a cut aiming at targetSeconds should start from: the latest one
 * at or before the target whose bytes appear only once in the list.
 *
 * A keyframe repeated byte for byte (a black or title-card intro) couldn't be
 * told apart from its twins when the cut is measured, so cutting there is avoided.
 *
 * @returns the keyframe, or null when no distinct keyframe precedes the target.
 */
export function latestDistinctKeyframeAtOrBefore(keyframes: KeyframePacket[], targetSeconds: number): KeyframePacket | null {
  const hashCounts = new Map<string, number>();
  for (const keyframe of keyframes) {
    hashCounts.set(keyframe.dataHash, (hashCounts.get(keyframe.dataHash) ?? 0) + 1);
  }
  return latest(atOrBefore(keyframes, targetSeconds).filter(keyframe => hashCounts.get(keyframe.dataHash) === 1));
}

/**
 * How far a stream-copy cut moved the timeline, measured rather than assumed.
 *
 * Demuxers do not all seek to the keyframe they are asked for (Matroska can
 * land a whole GOP early), but stream copy keeps packet bytes intact, so the
 * output's first keyframe is found in the source by its hash. The demuxer only
 * ever lands at or before the requested start, so later keyframes are ignored.
 *
 * Matched: offsetSeconds is source time minus output time for the same frame.
 */
export function measureCutOffset(
  sourceKeyframes: KeyframePacket[],
  outputFirstKeyframe: KeyframePacket,
  requestedStartSeconds: number,
): CutMeasurement {
  const candidates = atOrBefore(sourceKeyframes, requestedStartSeconds)
    .filter(keyframe => keyframe.dataHash === outputFirstKeyframe.dataHash);
  if (candidates.length === 0) return { status: 'unmatched' };
  if (candidates.length > 1) return { status: 'ambiguous' };
  return { status: 'matched', offsetSeconds: candidates[0]!.ptsSeconds - outputFirstKeyframe.ptsSeconds };
}
