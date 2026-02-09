import { useState, useRef, useCallback } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import { xToTime, yToPos } from '@/lib/timelineHitDetection';

const DRAG_THRESHOLD_PX = 5;

interface DragPreview {
  index: number;
  timeMs: number;
  pos: number;
}

interface UsePointDragProps {
  actions: FunscriptAction[];
  setActions: (actions: FunscriptAction[]) => void;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Manages threshold-based point dragging with live preview and commit-on-release.
 */
export function usePointDrag({
  actions,
  setActions,
  viewStart,
  viewEnd,
  canvasWidth,
  canvasHeight,
}: UsePointDragProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  const dragPointIndexRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; timeMs: number; pos: number } | null>(null);
  const dragThresholdMetRef = useRef(false);

  const startTracking = useCallback(
    (index: number, action: FunscriptAction, mouseX: number, mouseY: number) => {
      dragPointIndexRef.current = index;
      dragStartPosRef.current = { x: mouseX, y: mouseY, timeMs: action.at, pos: action.pos };
      dragThresholdMetRef.current = false;
      setIsDragging(false);
    },
    []
  );

  const updateTracking = useCallback(
    (mouseX: number, mouseY: number) => {
      if (dragPointIndexRef.current === null || !dragStartPosRef.current) return;

      const dx = mouseX - dragStartPosRef.current.x;
      const dy = mouseY - dragStartPosRef.current.y;

      if (!dragThresholdMetRef.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
        dragThresholdMetRef.current = true;
        setIsDragging(true);
      }

      if (dragThresholdMetRef.current) {
        setDragPreview({
          index: dragPointIndexRef.current,
          timeMs: xToTime(mouseX, viewStart, viewEnd, canvasWidth),
          pos: yToPos(mouseY, canvasHeight),
        });
      }
    },
    [viewStart, viewEnd, canvasWidth, canvasHeight]
  );

  /**
   * Finalize drag tracking. Returns the tracked point index and whether
   * a real drag occurred (true) or it was just a click (false).
   */
  const finalizeTracking = useCallback(
    (mouseX: number, mouseY: number): { wasDrag: boolean; index: number } | null => {
      if (dragPointIndexRef.current === null || !dragStartPosRef.current) return null;

      const index = dragPointIndexRef.current;
      let wasDrag = false;

      if (dragThresholdMetRef.current) {
        // Commit the move
        const newTimeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
        const newPos = yToPos(mouseY, canvasHeight);

        const newActions = actions.map((action, i) =>
          i === index
            ? { at: Math.round(newTimeMs), pos: Math.round(Math.max(0, Math.min(100, newPos))) }
            : action
        );
        newActions.sort((a, b) => a.at - b.at);
        setActions(newActions);

        setIsDragging(false);
        setDragPreview(null);
        wasDrag = true;
      }

      // Clear tracking state
      dragPointIndexRef.current = null;
      dragStartPosRef.current = null;
      dragThresholdMetRef.current = false;

      return { wasDrag, index };
    },
    [actions, setActions, viewStart, viewEnd, canvasWidth, canvasHeight]
  );

  return {
    isDragging,
    dragPreview,
    startTracking,
    updateTracking,
    finalizeTracking,
    get isTracking() { return dragPointIndexRef.current !== null; },
  };
}
