import React, { useRef, useEffect } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import { timeToX, posToY } from '@/lib/timelineHitDetection';

interface SmoothingOverlayProps {
  smoothedActions: FunscriptAction[];
  viewStart: number;
  viewEnd: number;
  width: number;
  height: number;
}

export const SmoothingOverlay = React.memo<SmoothingOverlayProps>(
  ({ smoothedActions, viewStart, viewEnd, width, height }) => {
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

      // Filter to visible viewport range
      const visibleActions = smoothedActions.filter(
        (action) => action.at >= viewStart && action.at <= viewEnd
      );

      if (visibleActions.length === 0) return;

      // Render smoothed preview as green line
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)'; // green
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      // Draw connected line segments
      visibleActions.forEach((action, index) => {
        const x = timeToX(action.at, viewStart, viewEnd, width);
        const y = posToY(action.pos, height);

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }, [smoothedActions, viewStart, viewEnd, width, height]);

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
      prevProps.smoothedActions === nextProps.smoothedActions &&
      prevProps.viewStart === nextProps.viewStart &&
      prevProps.viewEnd === nextProps.viewEnd &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height
    );
  }
);

SmoothingOverlay.displayName = 'SmoothingOverlay';
