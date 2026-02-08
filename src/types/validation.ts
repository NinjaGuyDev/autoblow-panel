// Validation types for funscript analysis

export type SegmentClassification = 'safe' | 'fast' | 'impossible';

export interface ValidatedSegment {
  startIndex: number;
  endIndex: number;
  classification: SegmentClassification;
  speed: number; // units per second
}

export interface ValidatedGap {
  startIndex: number; // Index of action before gap
  endIndex: number;   // Index of action after gap
  durationMs: number;
}

export interface ValidationResult {
  segments: ValidatedSegment[];
  gaps: ValidatedGap[];
  summary: {
    totalSegments: number;
    safeCount: number;
    fastCount: number;
    impossibleCount: number;
    gapCount: number;
  };
}
