import { useState, useRef, useCallback } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { EditMode } from '@/types/timeline';
import {
  hitTestActionPoint,
  xToTime,
  yToPos,
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

export interface UseTimelineEditorReturn {
  mode: EditMode;
  setMode: (mode: EditMode) => void;
  selectedIndices: Set<number>;
  clearSelection: () => void;
  hoveredIndex: number | null;
  isDragging: boolean;
  dragPreview: DragPreview | null;
  handleMouseDown: (mouseX: number, mouseY: number, e: React.MouseEvent) => void;
  handleMouseMove: (mouseX: number, mouseY: number) => void;
  handleMouseUp: (mouseX: number, mouseY: number) => void;
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

  // Drag state refs (avoid re-renders during drag)
  const dragPointIndexRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; timeMs: number; pos: number } | null>(null);
  const dragThresholdMetRef = useRef(false);

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

  const deletePoint = useCallback(
    (index: number) => {
      const newActions = actions.filter((_, i) => i !== index);
      setActions(newActions);
    },
    [actions, setActions]
  );

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
        // No hit
        if (mode === 'select') {
          // Allow click-to-seek to pass through
          // Future: Ctrl/Meta held will start selection rect (plan 03)
        }
      }
    },
    [actions, viewStart, viewEnd, canvasWidth, canvasHeight, mode]
  );

  const handleMouseMove = useCallback(
    (mouseX: number, mouseY: number) => {
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
    [actions, viewStart, viewEnd, canvasWidth, canvasHeight]
  );

  const handleMouseUp = useCallback(
    (mouseX: number, mouseY: number) => {
      if (dragPointIndexRef.current !== null && dragStartPosRef.current) {
        if (dragThresholdMetRef.current) {
          // Was dragging - commit the move
          const newTimeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
          const newPos = yToPos(mouseY, canvasHeight);
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
    },
    [viewStart, viewEnd, canvasWidth, canvasHeight, movePoint, selectedIndices]
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
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    deleteSelected,
    addPoint,
  };
}
