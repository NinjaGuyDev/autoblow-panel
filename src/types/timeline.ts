export interface TimelineViewportState {
  viewStart: number;       // Viewport start time in ms
  viewEnd: number;         // Computed: viewStart + viewportDuration
  viewportDuration: number; // How many ms are visible at once
}

export interface TimelineZoomConfig {
  minViewportDuration: number;  // Minimum ms visible (e.g., 2000 = 2 seconds)
  maxViewportDuration: number;  // Maximum ms visible (full script/video duration)
  zoomFactor: number;           // Multiplier per scroll step (e.g., 1.3)
}

export interface TimelineRenderData {
  actions: Array<{ pos: number; at: number }>;
  currentTimeMs: number;
  duration: number;         // Total duration in ms
  isPlaying: boolean;
  showActionPoints: boolean;
}
