import { useState, useCallback } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { EditMode, SelectionRect } from '@/types/timeline';
import { xToTime, yToPos } from '@/lib/timelineHitDetection';
import { usePointSelection } from '@/hooks/usePointSelection';
import { usePointDrag } from '@/hooks/usePointDrag';
import { useDrawMode } from '@/hooks/useDrawMode';

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

/**
 * Thin orchestrator that coordinates selection, drag, and draw sub-hooks
 * and routes mouse events to the appropriate subsystem.
 */
export function useTimelineEditor({
  actions,
  setActions,
  viewStart,
  viewEnd,
  canvasWidth,
  canvasHeight,
}: UseTimelineEditorProps): UseTimelineEditorReturn {
  const [mode, setMode] = useState<EditMode>('select');

  const coordParams = { viewStart, viewEnd, canvasWidth, canvasHeight };

  const selection = usePointSelection({ actions, ...coordParams });
  const drag = usePointDrag({ actions, setActions, ...coordParams });
  const draw = useDrawMode({ actions, setActions, ...coordParams });

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
    if (selection.selectedIndices.size === 0) return;
    const toDelete = new Set(selection.selectedIndices);
    setActions(actions.filter((_, i) => !toDelete.has(i)));
    selection.clearSelection();
  }, [actions, selection.selectedIndices, selection.clearSelection, setActions]);

  const handleMouseDown = useCallback(
    (mouseX: number, mouseY: number, e: React.MouseEvent) => {
      if (mode === 'draw') {
        draw.startDrawing(mouseX, mouseY);
        return;
      }

      const hit = selection.hitTest(mouseX, mouseY);
      if (hit) {
        drag.startTracking(hit.index, hit.action as FunscriptAction, mouseX, mouseY);
      } else if (mode === 'select') {
        selection.startRectSelection(mouseX, mouseY);
      }
    },
    [mode, selection, drag, draw]
  );

  const handleMouseMove = useCallback(
    (mouseX: number, mouseY: number) => {
      // Draw mode
      if (draw.isDrawing && mode === 'draw') {
        draw.continueDrawing(mouseX, mouseY);
        return;
      }

      // Rectangle selection (only when not tracking a drag)
      if (mode === 'select' && !drag.isTracking) {
        if (selection.updateRectSelection(mouseX, mouseY)) {
          return; // Actively selecting — skip hover
        }
      }

      // Hover
      selection.updateHover(mouseX, mouseY);

      // Drag tracking
      drag.updateTracking(mouseX, mouseY);
    },
    [mode, draw, drag, selection]
  );

  const handleMouseUp = useCallback(
    (_mouseX: number, _mouseY: number, e?: React.MouseEvent) => {
      // Finalize draw
      if (draw.isDrawing && mode === 'draw') {
        draw.finalizeDrawing();
        return;
      }

      // Finalize rectangle selection
      if (selection.isSelecting && selection.selectionRect) {
        selection.finalizeRectSelection(e?.shiftKey ?? false);
        return;
      }

      // Finalize drag (or handle click-to-select)
      const result = drag.finalizeTracking(_mouseX, _mouseY);
      if (result && !result.wasDrag) {
        selection.togglePoint(result.index);
      }

      // Clean up rect start if it was just a click
      selection.cancelRectSelection();
    },
    [mode, draw, drag, selection]
  );

  const handleDoubleClick = useCallback(
    (mouseX: number, mouseY: number) => {
      const hit = selection.hitTest(mouseX, mouseY);
      if (!hit) {
        const timeMs = xToTime(mouseX, viewStart, viewEnd, canvasWidth);
        const pos = yToPos(mouseY, canvasHeight);
        addPoint(timeMs, pos);
      }
    },
    [selection, viewStart, viewEnd, canvasWidth, canvasHeight, addPoint]
  );

  return {
    mode,
    setMode,
    selectedIndices: selection.selectedIndices,
    clearSelection: selection.clearSelection,
    hoveredIndex: selection.hoveredIndex,
    isDragging: drag.isDragging,
    dragPreview: drag.dragPreview,
    isDrawing: draw.isDrawing,
    drawPoints: draw.drawPoints,
    selectionRect: selection.selectionRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    deleteSelected,
    addPoint,
  };
}
