import { useState, useRef, useLayoutEffect } from 'react';
import { useTimelineViewport } from '@/hooks/useTimelineViewport';
import { TimelineCanvas } from './TimelineCanvas';
import { PlayheadOverlay } from './PlayheadOverlay';
import { TimelineAxis } from './TimelineAxis';
import { TimelineControls } from './TimelineControls';

interface TimelineProps {
  actions: Array<{ pos: number; at: number }>;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onSeek: (timeSeconds: number) => void;
}

const CANVAS_HEIGHT = 180;

export function Timeline({
  actions,
  currentTimeMs,
  durationMs,
  isPlaying,
  onSeek,
}: TimelineProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [showActionPoints, setShowActionPoints] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const rect = container.getBoundingClientRect();
      setContainerWidth(rect.width);
    };

    // Initial measurement
    updateWidth();

    // Update on window resize
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Viewport state (zoom, pan, auto-scroll)
  const viewport = useTimelineViewport({
    durationMs,
    currentTimeMs,
    isPlaying,
  });

  // Click to seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (durationMs === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / containerWidth;

    // Calculate timestamp at click position
    const clickedTimeMs = viewport.viewStart + clickRatio * viewport.viewportDuration;

    // Clamp to valid range and convert to seconds
    const clampedTimeMs = Math.max(0, Math.min(clickedTimeMs, durationMs));
    const timeSeconds = clampedTimeMs / 1000;

    onSeek(timeSeconds);
  };

  // Pan state
  const panStartRef = useRef<{ x: number; ratio: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseXRatio = mouseX / containerWidth;

    panStartRef.current = { x: mouseX, ratio: mouseXRatio };
    viewport.handlePanStart(mouseXRatio);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseXRatio = mouseX / containerWidth;

    viewport.handlePanMove(mouseXRatio);
  };

  const handleMouseUp = () => {
    panStartRef.current = null;
    viewport.handlePanEnd();
  };

  const handleMouseLeave = () => {
    if (panStartRef.current) {
      panStartRef.current = null;
      viewport.handlePanEnd();
    }
  };

  // Zoom button handlers
  const handleZoomIn = () => {
    if (durationMs === 0 || viewport.viewportDuration === 0) return;

    // Reduce viewport by 30%, center on playhead
    const newDuration = Math.max(2000, viewport.viewportDuration / 1.3);
    const playheadRatio = (currentTimeMs - viewport.viewStart) / viewport.viewportDuration;

    // Keep playhead at same screen position
    const newViewStart = currentTimeMs - playheadRatio * newDuration;
    const clampedViewStart = Math.max(0, Math.min(newViewStart, durationMs - newDuration));

    viewport.setViewportDuration(newDuration);
    viewport.setViewStart(clampedViewStart);
  };

  const handleZoomOut = () => {
    if (durationMs === 0 || viewport.viewportDuration === 0) return;

    // Increase viewport by 30%, center on playhead
    const newDuration = Math.min(durationMs, viewport.viewportDuration * 1.3);
    const playheadRatio = (currentTimeMs - viewport.viewStart) / viewport.viewportDuration;

    // Keep playhead at same screen position
    const newViewStart = currentTimeMs - playheadRatio * newDuration;
    const clampedViewStart = Math.max(0, Math.min(newViewStart, durationMs - newDuration));

    viewport.setViewportDuration(newDuration);
    viewport.setViewStart(clampedViewStart);
  };

  const handleZoomFit = () => {
    if (durationMs === 0) return;

    // Reset to show entire script
    viewport.setViewportDuration(durationMs);
    viewport.setViewStart(0);
  };

  // Empty state
  if (actions.length === 0) {
    return (
      <div
        ref={containerRef}
        className="bg-card border border-muted rounded-lg overflow-hidden"
      >
        <div
          className="flex items-center justify-center text-muted-foreground"
          style={{ height: CANVAS_HEIGHT }}
        >
          Load a funscript to see the timeline
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-card border border-muted rounded-lg overflow-hidden">
      <TimelineControls
        showActionPoints={showActionPoints}
        onToggleActionPoints={() => setShowActionPoints(!showActionPoints)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
      />

      <div className="relative" style={{ height: CANVAS_HEIGHT }}>
        {/* Canvas for area chart */}
        {containerWidth > 0 && (
          <TimelineCanvas
            actions={actions}
            viewStart={viewport.viewStart}
            viewEnd={viewport.viewEnd}
            showActionPoints={showActionPoints}
            width={containerWidth}
            height={CANVAS_HEIGHT}
          />
        )}

        {/* Playhead overlay */}
        {containerWidth > 0 && (
          <PlayheadOverlay
            currentTimeMs={currentTimeMs}
            viewStart={viewport.viewStart}
            viewEnd={viewport.viewEnd}
            width={containerWidth}
            height={CANVAS_HEIGHT}
            actions={actions}
          />
        )}

        {/* Interaction layer */}
        <div
          className="absolute inset-0 cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {containerWidth > 0 && (
        <TimelineAxis
          viewStart={viewport.viewStart}
          viewEnd={viewport.viewEnd}
          width={containerWidth}
        />
      )}
    </div>
  );
}
