import React, { useRef, useEffect } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { EditMode } from '@/types/timeline';
import { timeToX, posToY } from '@/lib/timelineHitDetection';

interface TimelineEditorOverlayProps {
  actions: FunscriptAction[];
  viewStart: number;
  viewEnd: number;
  width: number;
  height: number;
  selectedIndices: Set<number>;
  hoveredIndex: number | null;
  isDragging: boolean;
  dragPreview: { index: number; timeMs: number; pos: number } | null;
  mode: EditMode;
}

export const TimelineEditorOverlay = React.memo<TimelineEditorOverlayProps>(
  ({
    actions,
    viewStart,
    viewEnd,
    width,
    height,
    selectedIndices,
    hoveredIndex,
    isDragging,
    dragPreview,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;

      // Set canvas size accounting for HiDPI
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Filter visible actions
      const visibleActions = actions.filter(
        (action) => action.at >= viewStart && action.at <= viewEnd
      );

      // Draw all visible action points (small dots)
      ctx.fillStyle = '#60a5fa';
      visibleActions.forEach((action) => {
        // Find global index
        const index = actions.indexOf(action);
        if (index === -1) return;

        // Skip if selected, hovered, or being dragged (will be drawn separately)
        if (selectedIndices.has(index) || hoveredIndex === index || dragPreview?.index === index) {
          return;
        }

        const x = timeToX(action.at, viewStart, viewEnd, width);
        const y = posToY(action.pos, height);

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw hovered point (medium circle with subtle highlight)
      if (hoveredIndex !== null && !selectedIndices.has(hoveredIndex) && dragPreview?.index !== hoveredIndex) {
        const action = actions[hoveredIndex];
        if (action && action.at >= viewStart && action.at <= viewEnd) {
          const x = timeToX(action.at, viewStart, viewEnd, width);
          const y = posToY(action.pos, height);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw selected points (larger circles with bright highlight)
      selectedIndices.forEach((index) => {
        const action = actions[index];
        if (!action || action.at < viewStart || action.at > viewEnd) return;

        // Skip if being dragged (will be drawn in preview)
        if (dragPreview?.index === index) return;

        const x = timeToX(action.at, viewStart, viewEnd, width);
        const y = posToY(action.pos, height);

        // Bright yellow outline
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Blue fill
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw drag preview
      if (isDragging && dragPreview) {
        const originalAction = actions[dragPreview.index];
        if (originalAction) {
          const originalX = timeToX(originalAction.at, viewStart, viewEnd, width);
          const originalY = posToY(originalAction.pos, height);
          const previewX = timeToX(dragPreview.timeMs, viewStart, viewEnd, width);
          const previewY = posToY(dragPreview.pos, height);

          // Dashed line from original to preview position
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(originalX, originalY);
          ctx.lineTo(previewX, previewY);
          ctx.stroke();
          ctx.setLineDash([]); // Reset dash

          // Preview point at new position
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(previewX, previewY, 6, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.arc(previewX, previewY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, [
      actions,
      viewStart,
      viewEnd,
      width,
      height,
      selectedIndices,
      hoveredIndex,
      isDragging,
      dragPreview,
    ]);

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          pointerEvents: 'none',
        }}
      />
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to avoid unnecessary redraws
    return (
      prevProps.actions === nextProps.actions &&
      prevProps.viewStart === nextProps.viewStart &&
      prevProps.viewEnd === nextProps.viewEnd &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height &&
      prevProps.selectedIndices === nextProps.selectedIndices &&
      prevProps.hoveredIndex === nextProps.hoveredIndex &&
      prevProps.isDragging === nextProps.isDragging &&
      prevProps.dragPreview === nextProps.dragPreview &&
      prevProps.mode === nextProps.mode
    );
  }
);

TimelineEditorOverlay.displayName = 'TimelineEditorOverlay';
