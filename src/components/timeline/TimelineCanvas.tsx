import React, { useRef, useEffect, useMemo } from 'react';
import { timeToX, posToY, TOP_PADDING, BOTTOM_PADDING } from '@/lib/timelineHitDetection';

interface TimelineCanvasProps {
  actions: Array<{ pos: number; at: number }>;
  viewStart: number;
  viewEnd: number;
  showActionPoints: boolean;
  width: number;
  height: number;
}

export const TimelineCanvas = React.memo<TimelineCanvasProps>(
  ({ actions, viewStart, viewEnd, showActionPoints, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gradientRef = useRef<CanvasGradient | null>(null);
    const lastHeightRef = useRef<number>(0);

    // Filter visible actions with buffer for smooth edge rendering
    const visibleActions = useMemo(() => {
      if (actions.length === 0) return [];

      // Calculate buffer - one action spacing on each side
      const avgSpacing = actions.length > 1
        ? (actions[actions.length - 1].at - actions[0].at) / (actions.length - 1)
        : 1000;
      const buffer = avgSpacing * 2;

      return actions.filter(
        (action) => action.at >= viewStart - buffer && action.at <= viewEnd + buffer
      );
    }, [actions, viewStart, viewEnd]);

    // Create or recreate gradient when canvas height changes
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (lastHeightRef.current !== height) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const gradient = ctx.createLinearGradient(0, TOP_PADDING, 0, height - BOTTOM_PADDING);

        // Red at top (high intensity 80-100%)
        gradient.addColorStop(0.0, 'rgba(239, 68, 68, 0.8)');
        // Orange at ~60-80%
        gradient.addColorStop(0.3, 'rgba(249, 115, 22, 0.7)');
        // Amber at mid ~40-60%
        gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.6)');
        // Green at ~20-40%
        gradient.addColorStop(0.7, 'rgba(34, 197, 94, 0.5)');
        // Green lighter at bottom 0-20%
        gradient.addColorStop(1.0, 'rgba(34, 197, 94, 0.3)');

        gradientRef.current = gradient;
        lastHeightRef.current = height;
      }
    }, [height]);

    // Render the canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !gradientRef.current) return;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;

      // Set canvas size accounting for HiDPI
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Clear canvas with dark background
      ctx.fillStyle = 'hsl(240, 10%, 10%)';
      ctx.fillRect(0, 0, width, height);

      if (visibleActions.length === 0) return;

      // Draw horizontal grid lines at percentage marks
      ctx.strokeStyle = 'rgba(161, 161, 170, 0.1)';
      ctx.lineWidth = 1;
      [0, 25, 50, 75, 100].forEach((percent) => {
        const y = posToY(percent, height);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });

      // Draw Y-axis labels
      ctx.fillStyle = 'rgba(161, 161, 170, 0.7)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      [0, 25, 50, 75, 100].forEach((percent) => {
        const y = posToY(percent, height);
        ctx.fillText(`${percent}%`, 35, y);
      });

      // Draw filled area with gradient
      ctx.fillStyle = gradientRef.current;
      ctx.beginPath();

      // Start at bottom of first action
      const firstX = timeToX(visibleActions[0].at, viewStart, viewEnd, width);
      ctx.moveTo(firstX, posToY(0, height));

      // Trace through all actions
      visibleActions.forEach((action) => {
        const x = timeToX(action.at, viewStart, viewEnd, width);
        const y = posToY(action.pos, height);
        ctx.lineTo(x, y);
      });

      // Close path at bottom of last action
      const lastX = timeToX(visibleActions[visibleActions.length - 1].at, viewStart, viewEnd, width);
      ctx.lineTo(lastX, posToY(0, height));
      ctx.closePath();
      ctx.fill();

      // Draw line stroke on top of area
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

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

      // Draw action point dots if enabled
      if (showActionPoints) {
        ctx.fillStyle = '#60a5fa';
        visibleActions.forEach((action) => {
          const x = timeToX(action.at, viewStart, viewEnd, width);
          const y = posToY(action.pos, height);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }, [visibleActions, viewStart, viewEnd, showActionPoints, width, height]);

    return (
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to avoid unnecessary re-renders
    return (
      prevProps.actions === nextProps.actions &&
      prevProps.viewStart === nextProps.viewStart &&
      prevProps.viewEnd === nextProps.viewEnd &&
      prevProps.showActionPoints === nextProps.showActionPoints &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height
    );
  }
);

TimelineCanvas.displayName = 'TimelineCanvas';
