import { useState, useRef, useCallback } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { EditMode, SelectionRect } from '@/types/timeline';
import {
  hitTestActionPoint,
  xToTime,
  yToPos,
  getPointsInRect,
} from '@/lib/timelineHitDetection';

interface UseTimelineEditorProps {
  actions: FunscriptAction[];
  setActions: (actions: FunscriptAction[]) => void;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface DragPreview {
  index: number;
  timeMs: number;
  pos: number;
}

const DRAG_THRESHOLD_PX = 5;
const DRAW_SUBSAMPLE_MS = 50; // Minimum time gap between drawn points

export interface UseTimelineEditorReturn {
  mode: EditMode;
  setMode: (mode: EditMode) => void;
  selectedIndices: Set<number>;
  clearSelection: () => void;
  hoveredIndex: number | null;
  isDragging: boolean;
  dragPreview: DragPreview | null;
  isDrawing: boolean;
  drawPoints: Array<{ timeMs: number; pos: number }>;
  selectionRect: SelectionRect | null;
  handleMouseDown: (mouseX: number, mouseY: number, e: React.MouseEvent) => void;
  handleMouseMove: (mouseX: number, mouseY: number) => void;
  handleMouseUp: (mouseX: number, mouseY: number, e?: React.MouseEvent) => void;
  handleDoubleClick: (mouseX: number, mouseY: number) => void;
  deleteSelected: () => void;
  addPoint: (timeMs: number, pos: number) => void;
}

export function useTimelineEditor({
  actions,
  setActions,
  viewStart,
  viewEnd,
  canvasWidth,
  canvasHeight,
}: UseTimelineEditorProps): UseTimelineEditorReturn {
  const [mode, setMode] = useState<EditMode>('select');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Array<{ timeMs: number; pos: number }>>([]);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  // Drag state refs (avoid re-renders during drag)
  const dragPointIndexRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; timeMs: number; pos: number } | null>(null);
  const dragThresholdMetRef = useRef(false);

  // Rectangle selection refs
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const isSelectingRef = useRef(false);

  const addPoint = useCallback(
    (timeMs: number, pos: number) => {
      const newAction: FunscriptAction = {
        at: Math.round(timeMs),
        pos: Math.round(Math.max(0, Math.min(100, pos))),
      };

      const newActions = [...actions, newAction].sort((a, b) => a.at - b.at);
      setActions(newActions);
    },
    [actions, setActions]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) return;

    const indicesToDelete = new Set(selectedIndices);
    const newActions = actions.filter((_, index) => !indicesToDelete.has(index));
    setActions(newActions);
    setSelectedIndices(new Set());
  }, [actions, selectedIndices, setActions]);


  const movePoint = useCallback(
    (index: number, newTimeMs: number, newPos: number) => {
      const newActions = actions.map((action, i) => {
        if (i === index) {
          return {
            at: Math.round(newTimeMs),
            pos: Math.round(Math.max(0, Math.min(100, newPos))),
          };
        }
        return action;
      });

      // Sort by time after modification
      newActions.sort((a, b) => a.at - b.at);
      setActions(newActions);
    },
    [actions, setActions]
  );

  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleMouseDown = useCallback(
    (mouseX: number, mouseY: number, e: React.MouseEvent) => {
      if (mode === 'draw') {
        // Start drawing
        setIsDrawing(true);
        const timeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
        const pos = yToPos(mouseY, canvasHeight);
        setDrawPoints([{ timeMs, pos }]);
        return;
      }

      const hitResult = hitTestActionPoint(
        mouseX,
        mouseY,
        actions,
        viewStart,
        viewEnd,
        canvasWidth,
        canvasHeight
      );

      if (hitResult) {
        // Hit a point - start drag tracking
        dragPointIndexRef.current = hitResult.index;
        dragStartPosRef.current = {
          x: mouseX,
          y: mouseY,
          timeMs: hitResult.action.at,
          pos: hitResult.action.pos,
        };
        dragThresholdMetRef.current = false;
        setIsDragging(false); // Not yet dragging (waiting for threshold)
      } else {
        // No hit - potential rectangle selection in select mode
        if (mode === 'select') {
          // Store start position for potential rectangle selection
          rectStartRef.current = { x: mouseX, y: mouseY };
          isSelectingRef.current = false; // Not yet selecting (waiting for drag threshold)
        }
      }
    },
    [actions, viewStart, viewEnd, canvasWidth, canvasHeight, mode]
  );

  const handleMouseMove = useCallback(
    (mouseX: number, mouseY: number) => {
      // Handle draw mode
      if (isDrawing && mode === 'draw') {
        const timeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
        const pos = yToPos(mouseY, canvasHeight);

        // Subsample: only add if time diff from last point >= 50ms
        if (drawPoints.length > 0) {
          const lastPoint = drawPoints[drawPoints.length - 1];
          if (Math.abs(timeMs - lastPoint.timeMs) < DRAW_SUBSAMPLE_MS) {
            return; // Skip this point - too close to last one
          }
        }

        setDrawPoints([...drawPoints, { timeMs, pos }]);
        return;
      }

      // Handle rectangle selection
      if (rectStartRef.current && mode === 'select' && !dragPointIndexRef.current) {
        const dx = mouseX - rectStartRef.current.x;
        const dy = mouseY - rectStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!isSelectingRef.current && distance > DRAG_THRESHOLD_PX) {
          // Threshold met - start rectangle selection
          isSelectingRef.current = true;
        }

        if (isSelectingRef.current) {
          // Update selection rectangle
          setSelectionRect({
            startX: rectStartRef.current.x,
            startY: rectStartRef.current.y,
            endX: mouseX,
            endY: mouseY,
          });
          return; // Don't update hover during rectangle selection
        }
      }

      // Update hover state
      const hitResult = hitTestActionPoint(
        mouseX,
        mouseY,
        actions,
        viewStart,
        viewEnd,
        canvasWidth,
        canvasHeight
      );
      setHoveredIndex(hitResult ? hitResult.index : null);

      // Handle dragging
      if (dragPointIndexRef.current !== null && dragStartPosRef.current) {
        const dx = mouseX - dragStartPosRef.current.x;
        const dy = mouseY - dragStartPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!dragThresholdMetRef.current && distance > DRAG_THRESHOLD_PX) {
          // Threshold met - start actual drag
          dragThresholdMetRef.current = true;
          setIsDragging(true);
        }

        if (dragThresholdMetRef.current) {
          // Calculate new position from mouse
          const newTimeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
          const newPos = yToPos(mouseY, canvasHeight);

          setDragPreview({
            index: dragPointIndexRef.current,
            timeMs: newTimeMs,
            pos: newPos,
          });
        }
      }
    },
    [actions, viewStart, viewEnd, canvasWidth, canvasHeight, isDrawing, mode, drawPoints]
  );

  const handleMouseUp = useCallback(
    (_mouseX: number, _mouseY: number, e?: React.MouseEvent) => {
      // Handle draw mode
      if (isDrawing && mode === 'draw') {
        // Finalize the drawn curve
        if (drawPoints.length > 0) {
          // Subsample to ensure minimum 50ms intervals
          const subsampledPoints: Array<{ timeMs: number; pos: number }> = [];
          subsampledPoints.push(drawPoints[0]); // Always keep first point

          for (let i = 1; i < drawPoints.length - 1; i++) {
            const lastKept = subsampledPoints[subsampledPoints.length - 1];
            if (drawPoints[i].timeMs - lastKept.timeMs >= DRAW_SUBSAMPLE_MS) {
              subsampledPoints.push(drawPoints[i]);
            }
          }

          // Always keep last point
          if (drawPoints.length > 1) {
            subsampledPoints.push(drawPoints[drawPoints.length - 1]);
          }

          // Convert to FunscriptActions (clamp and round)
          const newActions: FunscriptAction[] = subsampledPoints.map((point) => ({
            at: Math.round(point.timeMs),
            pos: Math.round(Math.max(0, Math.min(100, point.pos))),
          }));

          // Merge with existing actions and sort
          const mergedActions = [...actions, ...newActions].sort((a, b) => a.at - b.at);
          setActions(mergedActions);
        }

        // Clear drawing state
        setIsDrawing(false);
        setDrawPoints([]);
        return;
      }

      // Handle rectangle selection
      if (isSelectingRef.current && selectionRect && mode === 'select') {
        // Find all points within rectangle
        const indicesInRect = getPointsInRect(
          selectionRect,
          actions,
          viewStart,
          viewEnd,
          canvasWidth,
          canvasHeight
        );

        // Check if Shift is held
        const shiftHeld = e?.shiftKey ?? false;

        if (shiftHeld) {
          // Add to existing selection
          const newSelection = new Set(selectedIndices);
          indicesInRect.forEach((idx) => newSelection.add(idx));
          setSelectedIndices(newSelection);
        } else {
          // Replace selection
          setSelectedIndices(new Set(indicesInRect));
        }

        // Clear rectangle selection state
        setSelectionRect(null);
        rectStartRef.current = null;
        isSelectingRef.current = false;
        return;
      }

      if (dragPointIndexRef.current !== null && dragStartPosRef.current) {
        if (dragThresholdMetRef.current) {
          // Was dragging - commit the move
          const newTimeMs = xToTime(_mouseX, viewStart, viewEnd, canvasWidth);
          const newPos = yToPos(_mouseY, canvasHeight);
          movePoint(dragPointIndexRef.current, newTimeMs, newPos);
          setIsDragging(false);
          setDragPreview(null);
        } else {
          // Was a click (not a drag) - select the point
          const index = dragPointIndexRef.current;
          if (selectedIndices.has(index)) {
            // Deselect
            const newSelection = new Set(selectedIndices);
            newSelection.delete(index);
            setSelectedIndices(newSelection);
          } else {
            // Select (replace current selection)
            setSelectedIndices(new Set([index]));
          }
        }

        // Clear drag state
        dragPointIndexRef.current = null;
        dragStartPosRef.current = null;
        dragThresholdMetRef.current = false;
      }

      // Clear rectangle selection if it was just a click (didn't exceed threshold)
      if (rectStartRef.current && !isSelectingRef.current) {
        rectStartRef.current = null;
      }
    },
    [viewStart, viewEnd, canvasWidth, canvasHeight, movePoint, selectedIndices, isDrawing, mode, drawPoints, actions, setActions, selectionRect]
  );

  const handleDoubleClick = useCallback(
    (mouseX: number, mouseY: number) => {
      // Check if double-click hit an existing point
      const hitResult = hitTestActionPoint(
        mouseX,
        mouseY,
        actions,
        viewStart,
        viewEnd,
        canvasWidth,
        canvasHeight
      );

      if (!hitResult) {
        // No existing point - add a new one
        const timeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
        const pos = yToPos(mouseY, canvasHeight);
        addPoint(timeMs, pos);
      }
    },
    [actions, viewStart, viewEnd, canvasWidth, canvasHeight, addPoint]
  );

  return {
    mode,
    setMode,
    selectedIndices,
    clearSelection,
    hoveredIndex,
    isDragging,
    dragPreview,
    isDrawing,
    drawPoints,
    selectionRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    deleteSelected,
    addPoint,
  };
}
