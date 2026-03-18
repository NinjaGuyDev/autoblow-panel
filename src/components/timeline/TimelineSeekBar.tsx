import React, { useRef, useEffect } from 'react';

interface TimelineSeekBarProps {
  durationMs: number;
  currentTimeMs: number;
  viewStart: number;
  viewEnd: number;
  width: number;
  onSeek: (timeMs: number) => void;
  onPanStart: (startXRatio: number) => void;
  onPanMove: (currentXRatio: number) => void;
  onPanEnd: () => void;
}

const SEEKBAR_HEIGHT = 20;

/**
 * Timeline seek bar component
 *
 * Renders a thin horizontal bar at the bottom of the timeline showing:
 * - Full timeline extent (0 to durationMs)
 * - Current viewport window (viewStart to viewEnd) as a highlighted region
 * - Current playhead position
 *
 * Supports:
 * - Click to seek to position
 * - Drag to pan viewport (global document listeners prevent drag cancellation
 *   when the cursor leaves the element bounds)
 */
export const TimelineSeekBar = React.memo<TimelineSeekBarProps>(
  ({
    durationMs,
    currentTimeMs,
    viewStart,
    viewEnd,
    width,
    onSeek,
    onPanStart,
    onPanMove,
    onPanEnd,
  }) => {
    const isDraggingRef = useRef(false);
    const divRef = useRef<HTMLDivElement>(null);

    // Keep a mutable snapshot of props that global handlers need — avoids stale closures
    const propsRef = useRef({ onPanMove, onPanEnd, width });
    propsRef.current = { onPanMove, onPanEnd, width };

    // Mutable handler bodies updated each render
    const handlersRef = useRef({
      move: null as ((e: MouseEvent) => void) | null,
      up: null as (() => void) | null,
    });

    // Stable function references (created once) — safe to add/remove from document
    const stableMove = useRef((e: MouseEvent) => {
      handlersRef.current.move?.(e);
    }).current;

    const stableUp = useRef(() => {
      handlersRef.current.up?.();
    }).current;

    handlersRef.current.move = (e: MouseEvent) => {
      if (!isDraggingRef.current || !divRef.current) return;
      const rect = divRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentRatio = currentX / propsRef.current.width;
      propsRef.current.onPanMove(currentRatio);
    };

    handlersRef.current.up = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', stableMove);
      document.removeEventListener('mouseup', stableUp);
      propsRef.current.onPanEnd();
    };

    // Cleanup global listeners if component unmounts mid-drag
    useEffect(() => {
      return () => {
        document.removeEventListener('mousemove', stableMove);
        document.removeEventListener('mouseup', stableUp);
      };
    }, [stableMove, stableUp]);

    if (durationMs === 0 || width === 0) {
      return (
        <div
          className="bg-stone-950 border-t border-stone-800"
          style={{ height: `${SEEKBAR_HEIGHT}px` }}
        />
      );
    }

    // Calculate viewport window position and width as ratio of total duration
    const viewStartRatio = viewStart / durationMs;
    const viewEndRatio = viewEnd / durationMs;
    const viewportWidth = (viewEndRatio - viewStartRatio) * width;
    const viewportLeft = viewStartRatio * width;

    // Calculate playhead position as ratio of total duration
    const playheadRatio = currentTimeMs / durationMs;
    const playheadLeft = playheadRatio * width;

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickRatio = clickX / width;

      // Check if click is inside viewport window
      const clickedInViewport = clickRatio >= viewStartRatio && clickRatio <= viewEndRatio;

      if (clickedInViewport) {
        isDraggingRef.current = true;
        document.addEventListener('mousemove', stableMove);
        document.addEventListener('mouseup', stableUp);
        onPanStart(clickRatio);
      } else {
        // Jump to clicked position (center viewport at click)
        const clickedTimeMs = clickRatio * durationMs;
        onSeek(clickedTimeMs / 1000); // onSeek expects seconds
      }
    };

    return (
      <div
        ref={divRef}
        className="relative bg-stone-950 border-t border-stone-800 cursor-pointer"
        style={{ height: `${SEEKBAR_HEIGHT}px`, width: `${width}px` }}
        onMouseDown={handleMouseDown}
      >
        {/* Viewport window indicator */}
        <div
          className="absolute top-0 bottom-0 bg-amber-500/30 border-l border-r border-amber-400/50"
          style={{
            left: `${viewportLeft}px`,
            width: `${viewportWidth}px`,
          }}
        />

        {/* Playhead indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{
            left: `${playheadLeft}px`,
          }}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to avoid unnecessary re-renders
    return (
      prevProps.durationMs === nextProps.durationMs &&
      prevProps.currentTimeMs === nextProps.currentTimeMs &&
      prevProps.viewStart === nextProps.viewStart &&
      prevProps.viewEnd === nextProps.viewEnd &&
      prevProps.width === nextProps.width &&
      prevProps.onSeek === nextProps.onSeek &&
      prevProps.onPanStart === nextProps.onPanStart &&
      prevProps.onPanMove === nextProps.onPanMove &&
      prevProps.onPanEnd === nextProps.onPanEnd
    );
  }
);

TimelineSeekBar.displayName = 'TimelineSeekBar';
