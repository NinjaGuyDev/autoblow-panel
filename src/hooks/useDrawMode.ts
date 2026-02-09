import { useState, useCallback } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import { xToTime, yToPos } from '@/lib/timelineHitDetection';

const DRAW_SUBSAMPLE_MS = 50;

interface UseDrawModeProps {
  actions: FunscriptAction[];
  setActions: (actions: FunscriptAction[]) => void;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Manages free-draw point collection with subsampling and merge-on-release.
 */
export function useDrawMode({
  actions,
  setActions,
  viewStart,
  viewEnd,
  canvasWidth,
  canvasHeight,
}: UseDrawModeProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Array<{ timeMs: number; pos: number }>>([]);

  const startDrawing = useCallback(
    (mouseX: number, mouseY: number) => {
      setIsDrawing(true);
      const timeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
      const pos = yToPos(mouseY, canvasHeight);
      setDrawPoints([{ timeMs, pos }]);
    },
    [viewStart, viewEnd, canvasWidth, canvasHeight]
  );

  const continueDrawing = useCallback(
    (mouseX: number, mouseY: number) => {
      const timeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
      const pos = yToPos(mouseY, canvasHeight);

      setDrawPoints((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (Math.abs(timeMs - last.timeMs) < DRAW_SUBSAMPLE_MS) {
            return prev; // Too close — skip
          }
        }
        return [...prev, { timeMs, pos }];
      });
    },
    [viewStart, viewEnd, canvasWidth, canvasHeight]
  );

  const finalizeDrawing = useCallback(() => {
    if (drawPoints.length === 0) {
      setIsDrawing(false);
      setDrawPoints([]);
      return;
    }

    // Subsample to ensure minimum intervals
    const subsampled: Array<{ timeMs: number; pos: number }> = [drawPoints[0]];
    for (let i = 1; i < drawPoints.length - 1; i++) {
      const last = subsampled[subsampled.length - 1];
      if (drawPoints[i].timeMs - last.timeMs >= DRAW_SUBSAMPLE_MS) {
        subsampled.push(drawPoints[i]);
      }
    }
    if (drawPoints.length > 1) {
      subsampled.push(drawPoints[drawPoints.length - 1]);
    }

    // Convert to clamped FunscriptActions
    const newActions: FunscriptAction[] = subsampled.map((pt) => ({
      at: Math.round(pt.timeMs),
      pos: Math.round(Math.max(0, Math.min(100, pt.pos))),
    }));

    // Merge with existing actions and sort
    const merged = [...actions, ...newActions].sort((a, b) => a.at - b.at);
    setActions(merged);

    setIsDrawing(false);
    setDrawPoints([]);
  }, [actions, setActions, drawPoints]);

  return {
    isDrawing,
    drawPoints,
    startDrawing,
    continueDrawing,
    finalizeDrawing,
  };
}
