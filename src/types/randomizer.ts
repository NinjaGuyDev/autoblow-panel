import type { FunscriptAction } from '@/types/funscript';

export interface RandomizedSegment {
  patternName: string;
  patternId: string;
  startMs: number;
  endMs: number;
  audioFile?: string;
}

export interface RandomizedScript {
  actions: FunscriptAction[];
  segments: RandomizedSegment[];
  totalDurationMs: number;
}
