import { useState, useRef, useCallback } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { SelectionRect, HitTestResult } from '@/types/timeline';
import {
  hitTestActionPoint,
  getPointsInRect,
} from '@/lib/timelineHitDetection';

const SELECTION_THRESHOLD_PX = 5;

interface UsePointSelectionProps {
  actions: FunscriptAction[];
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Manages point selection state: click-to-select, rectangle selection, and hover tracking.
 */
export function usePointSelection({
  actions,
  viewStart,
  viewEnd,
  canvasWidth,
  canvasHeight,
}: UsePointSelectionProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const isSelectingRef = useRef(false);

  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const hitTest = useCallback(
    (mouseX: number, mouseY: number): HitTestResult | null =>
      hitTestActionPoint(mouseX, mouseY, actions, viewStart, viewEnd, canvasWidth, canvasHeight),
    [actions, viewStart, viewEnd, canvasWidth, canvasHeight]
  );

  const updateHover = useCallback(
    (mouseX: number, mouseY: number) => {
      const result = hitTest(mouseX, mouseY);
      setHoveredIndex(result ? result.index : null);
    },
    [hitTest]
  );

  const togglePoint = useCallback(
    (index: number) => {
      if (selectedIndices.has(index)) {
        const next = new Set(selectedIndices);
        next.delete(index);
        setSelectedIndices(next);
      } else {
        setSelectedIndices(new Set([index]));
      }
    },
    [selectedIndices]
  );

  const startRectSelection = useCallback((mouseX: number, mouseY: number) => {
    rectStartRef.current = { x: mouseX, y: mouseY };
    isSelectingRef.current = false;
  }, []);

  /** Update the selection rectangle. Returns true when actively selecting (threshold met). */
  const updateRectSelection = useCallback(
    (mouseX: number, mouseY: number): boolean => {
      if (!rectStartRef.current) return false;

      const dx = mouseX - rectStartRef.current.x;
      const dy = mouseY - rectStartRef.current.y;

      if (!isSelectingRef.current && Math.sqrt(dx * dx + dy * dy) > SELECTION_THRESHOLD_PX) {
        isSelectingRef.current = true;
      }

      if (isSelectingRef.current) {
        setSelectionRect({
          startX: rectStartRef.current.x,
          startY: rectStartRef.current.y,
          endX: mouseX,
          endY: mouseY,
        });
        return true;
      }

      return false;
    },
    []
  );

  const finalizeRectSelection = useCallback(
    (shiftHeld: boolean) => {
      if (!isSelectingRef.current || !selectionRect) return;

      const indicesInRect = getPointsInRect(
        selectionRect, actions, viewStart, viewEnd, canvasWidth, canvasHeight
      );

      if (shiftHeld) {
        const next = new Set(selectedIndices);
        indicesInRect.forEach((idx) => next.add(idx));
        setSelectedIndices(next);
      } else {
        setSelectedIndices(new Set(indicesInRect));
      }

      setSelectionRect(null);
      rectStartRef.current = null;
      isSelectingRef.current = false;
    },
    [actions, viewStart, viewEnd, canvasWidth, canvasHeight, selectionRect, selectedIndices]
  );

  /** Clean up rect selection state if the click didn't exceed the threshold. */
  const cancelRectSelection = useCallback(() => {
    if (rectStartRef.current && !isSelectingRef.current) {
      rectStartRef.current = null;
    }
  }, []);

  return {
    selectedIndices,
    hoveredIndex,
    selectionRect,
    clearSelection,
    hitTest,
    updateHover,
    togglePoint,
    startRectSelection,
    updateRectSelection,
    finalizeRectSelection,
    cancelRectSelection,
    get isSelecting() { return isSelectingRef.current; },
  };
}
