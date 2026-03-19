import type { FunscriptAction } from '@/types/funscript';

export interface RandomizedSegment {
  patternName: string;
  patternId: string;
  startMs: number;
  endMs: number;
  audioFile?: string;
}

/** A timed audio cue that triggers at a specific timestamp during playback */
export interface AudioTimelineCue {
  /** When to start playing this audio (ms from script start) */
  startMs: number;
  /** Audio file in the media directory */
  audioFile: string;
  /** Duration of the audio clip (seconds) — used to avoid overlaps */
  durationSec: number;
}

export interface RandomizedScript {
  actions: FunscriptAction[];
  segments: RandomizedSegment[];
  totalDurationMs: number;
  /** Optional: timed audio cues at arbitrary timestamps (takes priority over segment audio) */
  audioTimeline?: AudioTimelineCue[];
}
