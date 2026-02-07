import React, { useRef, useEffect } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { EditMode, SelectionRect } from '@/types/timeline';
import { timeToX, posToY, getPointsInRect } from '@/lib/timelineHitDetection';

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
  drawPoints?: Array<{ timeMs: number; pos: number }>;
  selectionRect?: SelectionRect | null;
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
    drawPoints,
    selectionRect,
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

      // Draw freehand drawing preview
      if (drawPoints && drawPoints.length >= 2) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)'; // Bright cyan
        ctx.lineWidth = 2;
        ctx.beginPath();

        // Draw connected line through all points
        const firstPoint = drawPoints[0];
        const firstX = timeToX(firstPoint.timeMs, viewStart, viewEnd, width);
        const firstY = posToY(firstPoint.pos, height);
        ctx.moveTo(firstX, firstY);

        for (let i = 1; i < drawPoints.length; i++) {
          const point = drawPoints[i];
          const x = timeToX(point.timeMs, viewStart, viewEnd, width);
          const y = posToY(point.pos, height);
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw small dots at each point
        ctx.fillStyle = 'rgba(34, 211, 238, 1)'; // Solid cyan
        drawPoints.forEach((point) => {
          const x = timeToX(point.timeMs, viewStart, viewEnd, width);
          const y = posToY(point.pos, height);
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw selection rectangle
      if (selectionRect) {
        const minX = Math.min(selectionRect.startX, selectionRect.endX);
        const maxX = Math.max(selectionRect.startX, selectionRect.endX);
        const minY = Math.min(selectionRect.startY, selectionRect.endY);
        const maxY = Math.max(selectionRect.startY, selectionRect.endY);
        const rectWidth = maxX - minX;
        const rectHeight = maxY - minY;

        // Fill
        ctx.fillStyle = 'rgba(96, 165, 250, 0.15)'; // Subtle blue fill
        ctx.fillRect(minX, minY, rectWidth, rectHeight);

        // Border
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)'; // Blue border
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // Dashed
        ctx.strokeRect(minX, minY, rectWidth, rectHeight);
        ctx.setLineDash([]); // Reset dash

        // Highlight points within rectangle (live preview)
        const indicesInRect = getPointsInRect(
          selectionRect,
          actions,
          viewStart,
          viewEnd,
          width,
          height
        );

        indicesInRect.forEach((index) => {
          const action = actions[index];
          if (!action || action.at < viewStart || action.at > viewEnd) return;

          const x = timeToX(action.at, viewStart, viewEnd, width);
          const y = posToY(action.pos, height);

          // Yellow outline (same as selected)
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
      drawPoints,
      selectionRect,
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
      prevProps.mode === nextProps.mode &&
      prevProps.drawPoints === nextProps.drawPoints &&
      prevProps.selectionRect === nextProps.selectionRect
    );
  }
);

TimelineEditorOverlay.displayName = 'TimelineEditorOverlay';
