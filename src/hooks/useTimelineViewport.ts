import { useState, useEffect, useRef } from 'react';

interface UseTimelineViewportProps {
  durationMs: number;       // Total video/script duration in ms
  currentTimeMs: number;    // Current playback position in ms
  isPlaying: boolean;       // Whether video is playing
}

interface UseTimelineViewportReturn {
  viewStart: number;           // Start of visible window (ms)
  viewEnd: number;             // End of visible window (ms)
  viewportDuration: number;    // Width of visible window (ms)
  handlePanStart: (startXRatio: number) => void;
  handlePanMove: (currentXRatio: number) => void;
  handlePanEnd: () => void;
  setViewStart: (ms: number) => void;
  setViewportDuration: (ms: number) => void;
}

/**
 * Manages timeline viewport state with pan and auto-scroll
 *
 * Features:
 * - Pan support: Drag to scroll the timeline
 * - Auto-scroll: Keeps playhead centered during playback (with user interaction suppression)
 * - Programmatic zoom: Via setViewportDuration (used by zoom buttons)
 */
export function useTimelineViewport({
  durationMs,
  currentTimeMs,
  isPlaying,
}: UseTimelineViewportProps): UseTimelineViewportReturn {
  // Initial viewport: 10 seconds or full duration if shorter
  const initialViewportDuration = Math.min(10000, durationMs || 10000);

  const [viewStart, setViewStart] = useState(0);
  const [viewportDuration, setViewportDuration] = useState(initialViewportDuration);

  // Refs for pan state (avoid re-renders)
  const panStartXRatio = useRef<number | null>(null);
  const panStartViewStart = useRef<number>(0);
  const userInteracting = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed viewport end
  const viewEnd = viewStart + viewportDuration;

  // Reset viewport when duration changes (new video loaded)
  useEffect(() => {
    if (durationMs > 0) {
      setViewStart(0);
      setViewportDuration(Math.min(10000, durationMs));
    }
  }, [durationMs]);

  // Auto-scroll during playback (keeps playhead centered)
  useEffect(() => {
    if (!isPlaying || userInteracting.current || durationMs === 0) {
      return;
    }

    // Check if playhead is outside the center 60% of viewport
    const playheadPositionRatio = (currentTimeMs - viewStart) / viewportDuration;

    // If playhead is before 20% or after 80% mark, recenter at 50%
    if (playheadPositionRatio < 0.2 || playheadPositionRatio > 0.8) {
      // Center playhead at 50% of viewport
      const newViewStart = currentTimeMs - viewportDuration * 0.5;
      // Clamp to valid range
      const clampedViewStart = Math.max(0, Math.min(newViewStart, durationMs - viewportDuration));
      setViewStart(clampedViewStart);
    }
  }, [currentTimeMs, isPlaying, viewStart, viewportDuration, durationMs]);

  // Reset userInteracting when play starts
  useEffect(() => {
    if (isPlaying) {
      userInteracting.current = false;
      // Clear any pending timeout
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = null;
      }
    }
  }, [isPlaying]);

  /**
   * Start panning (user pressed mouse down)
   * @param startXRatio Initial cursor position (0-1)
   */
  const handlePanStart = (startXRatio: number) => {
    panStartXRatio.current = startXRatio;
    panStartViewStart.current = viewStart;
    userInteracting.current = true;

    // Clear any pending auto-scroll timeout
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }
  };

  /**
   * Continue panning (user dragged mouse)
   * @param currentXRatio Current cursor position (0-1)
   */
  const handlePanMove = (currentXRatio: number) => {
    if (panStartXRatio.current === null || durationMs === 0) return;

    // Calculate how far the cursor moved (in ratio units)
    const deltaRatio = currentXRatio - panStartXRatio.current;

    // Translate to time offset
    const deltaTime = deltaRatio * viewportDuration;

    // Update viewStart (inverted: drag right = scroll left)
    const newViewStart = panStartViewStart.current - deltaTime;

    // Clamp to valid range
    const clampedViewStart = Math.max(0, Math.min(newViewStart, durationMs - viewportDuration));

    setViewStart(clampedViewStart);
  };

  /**
   * End panning (user released mouse)
   */
  const handlePanEnd = () => {
    panStartXRatio.current = null;

    // Resume auto-scroll after 3 seconds of inactivity
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
    }
    autoScrollTimeoutRef.current = setTimeout(() => {
      userInteracting.current = false;
    }, 3000);
  };

  return {
    viewStart,
    viewEnd,
    viewportDuration,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    setViewStart,
    setViewportDuration,
  };
}
