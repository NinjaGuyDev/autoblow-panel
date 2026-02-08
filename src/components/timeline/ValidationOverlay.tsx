import React, { useRef, useEffect } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { ValidatedSegment, ValidatedGap } from '@/types/validation';
import { timeToX, posToY } from '@/lib/timelineHitDetection';

interface ValidationOverlayProps {
  actions: FunscriptAction[];
  segments: ValidatedSegment[];
  gaps: ValidatedGap[];
  viewStart: number;
  viewEnd: number;
  width: number;
  height: number;
}

export const ValidationOverlay = React.memo<ValidationOverlayProps>(
  ({ actions, segments, gaps, viewStart, viewEnd, width, height }) => {
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

      // Classification color map
      const classificationColors = {
        safe: 'rgba(34, 197, 94, 0.9)', // green
        fast: 'rgba(251, 191, 36, 0.9)', // amber/yellow
        impossible: 'rgba(239, 68, 68, 0.9)', // red
      };

      // Filter segments to viewport range
      const visibleSegments = segments.filter((segment) => {
        const startAction = actions[segment.startIndex];
        const endAction = actions[segment.endIndex];
        return endAction.at >= viewStart && startAction.at <= viewEnd;
      });

      // Group segments by classification for batch rendering
      const segmentsByClassification: Record<
        'safe' | 'fast' | 'impossible',
        ValidatedSegment[]
      > = {
        safe: [],
        fast: [],
        impossible: [],
      };

      visibleSegments.forEach((segment) => {
        segmentsByClassification[segment.classification].push(segment);
      });

      // Render each classification group
      ctx.lineWidth = 2.5;
      Object.entries(segmentsByClassification).forEach(([classification, segs]) => {
        if (segs.length === 0) return;

        ctx.strokeStyle =
          classificationColors[classification as 'safe' | 'fast' | 'impossible'];
        ctx.beginPath();

        segs.forEach((segment) => {
          const startAction = actions[segment.startIndex];
          const endAction = actions[segment.endIndex];

          const x1 = timeToX(startAction.at, viewStart, viewEnd, width);
          const y1 = posToY(startAction.pos, height);
          const x2 = timeToX(endAction.at, viewStart, viewEnd, width);
          const y2 = posToY(endAction.pos, height);

          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        });

        ctx.stroke();
      });

      // Filter gaps to viewport range
      const visibleGaps = gaps.filter((gap) => {
        const startAction = actions[gap.startIndex];
        const endAction = actions[gap.endIndex];
        return endAction.at >= viewStart && startAction.at <= viewEnd;
      });

      // Render gaps (dashed lines with labels)
      visibleGaps.forEach((gap) => {
        const startAction = actions[gap.startIndex];
        const endAction = actions[gap.endIndex];

        const gapStartX = timeToX(startAction.at, viewStart, viewEnd, width);
        const gapEndX = timeToX(endAction.at, viewStart, viewEnd, width);
        const midY = height / 2;

        // Dashed horizontal line
        ctx.strokeStyle = 'rgba(161, 161, 170, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(gapStartX, midY);
        ctx.lineTo(gapEndX, midY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Duration label centered above the line
        const durationText = `${(gap.durationMs / 1000).toFixed(1)}s pause`;
        const labelX = (gapStartX + gapEndX) / 2;
        const labelY = midY - 5;

        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(161, 161, 170, 0.8)';
        ctx.fillText(durationText, labelX, labelY);
      });
    }, [actions, segments, gaps, viewStart, viewEnd, width, height]);

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
      prevProps.segments === nextProps.segments &&
      prevProps.gaps === nextProps.gaps &&
      prevProps.viewStart === nextProps.viewStart &&
      prevProps.viewEnd === nextProps.viewEnd &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height
    );
  }
);

ValidationOverlay.displayName = 'ValidationOverlay';
