import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useTimelineViewport } from '@/hooks/useTimelineViewport';
import { useTimelineEditor } from '@/hooks/useTimelineEditor';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineEditorOverlay } from './TimelineEditorOverlay';
import { PlayheadOverlay } from './PlayheadOverlay';
import { TimelineAxis } from './TimelineAxis';
import { TimelineControls } from './TimelineControls';
import type { FunscriptAction } from '@/types/funscript';

interface TimelineProps {
  actions: Array<{ pos: number; at: number }>;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onSeek: (timeSeconds: number) => void;
  onActionsChange?: (actions: FunscriptAction[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onExport?: () => void;
}

const CANVAS_HEIGHT = 180;

export function Timeline({
  actions,
  currentTimeMs,
  durationMs,
  isPlaying,
  onSeek,
  onActionsChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
}: TimelineProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [showActionPoints, setShowActionPoints] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if in edit mode
  const isEditMode = !!onActionsChange;

  // Measure container width
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const rect = container.getBoundingClientRect();
      setContainerWidth(rect.width);
    };

    // Initial measurement
    updateWidth();

    // Update on window resize
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Viewport state (zoom, pan, auto-scroll)
  const viewport = useTimelineViewport({
    durationMs,
    currentTimeMs,
    isPlaying,
  });

  // Editor state (only when in edit mode)
  const editor = isEditMode
    ? useTimelineEditor({
        actions,
        setActions: onActionsChange,
        viewStart: viewport.viewStart,
        viewEnd: viewport.viewEnd,
        canvasWidth: containerWidth,
        canvasHeight: CANVAS_HEIGHT,
      })
    : null;

  // Keyboard shortcuts for edit mode
  useEffect(() => {
    if (!isEditMode || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field (but allow range inputs)
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type !== 'range'
      ) {
        return;
      }
      if (target.tagName === 'TEXTAREA') {
        return;
      }

      // Undo: Ctrl+Z
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && onUndo) {
        e.preventDefault();
        onUndo();
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if (
        ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
          (e.key === 'y' && (e.ctrlKey || e.metaKey))) &&
        onRedo
      ) {
        e.preventDefault();
        onRedo();
      }

      // Delete: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selectedIndices.size > 0) {
        e.preventDefault();
        editor.deleteSelected();
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        editor.clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, editor, onUndo, onRedo]);

  // Click to seek (or editor interaction)
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // In edit mode, click-to-seek is handled by the interaction layer
    // This function is kept for backward compatibility with read-only mode
    if (isEditMode) return;

    if (durationMs === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / containerWidth;

    // Calculate timestamp at click position
    const clickedTimeMs = viewport.viewStart + clickRatio * viewport.viewportDuration;

    // Clamp to valid range and convert to seconds
    const clampedTimeMs = Math.max(0, Math.min(clickedTimeMs, durationMs));
    const timeSeconds = clampedTimeMs / 1000;

    onSeek(timeSeconds);
  };

  // Pan state
  const panStartRef = useRef<{ x: number; ratio: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseXRatio = mouseX / containerWidth;

    if (isEditMode && editor) {
      // Let editor handle it first
      editor.handleMouseDown(mouseX, mouseY, e);
      // Don't start pan - wait to see if editor starts dragging
    } else {
      // Read-only mode: start pan
      panStartRef.current = { x: mouseX, ratio: mouseXRatio };
      viewport.handlePanStart(mouseXRatio);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseXRatio = mouseX / containerWidth;

    if (isEditMode && editor) {
      // Always update editor state
      editor.handleMouseMove(mouseX, mouseY);

      // If editor is dragging or selecting, don't pan
      if (editor.isDragging || editor.selectionRect) {
        return;
      }

      // If not dragging/selecting but mouse is down, start/continue pan
      if (panStartRef.current) {
        viewport.handlePanMove(mouseXRatio);
      }
    } else {
      // Read-only mode: pan if mouse is down
      if (!panStartRef.current) return;
      viewport.handlePanMove(mouseXRatio);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isEditMode && editor) {
      const wasDragging = editor.isDragging;
      const wasSelecting = editor.selectionRect !== null;

      // Pass event to editor (for Shift key detection)
      editor.handleMouseUp(mouseX, mouseY, e);

      // If was dragging or selecting, don't fire click-to-seek
      if (!wasDragging && !wasSelecting && durationMs > 0 && !panStartRef.current) {
        // Click-to-seek (simple click on empty space)
        const clickRatio = mouseX / containerWidth;
        const clickedTimeMs = viewport.viewStart + clickRatio * viewport.viewportDuration;
        const clampedTimeMs = Math.max(0, Math.min(clickedTimeMs, durationMs));
        const timeSeconds = clampedTimeMs / 1000;
        onSeek(timeSeconds);
      }
    }

    panStartRef.current = null;
    viewport.handlePanEnd();
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditMode && editor) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      editor.handleDoubleClick(mouseX, mouseY);
    }
  };

  const handleMouseLeave = () => {
    if (panStartRef.current) {
      panStartRef.current = null;
      viewport.handlePanEnd();
    }
  };

  // Zoom button handlers
  const handleZoomIn = () => {
    if (durationMs === 0 || viewport.viewportDuration === 0) return;

    // Reduce viewport by 30%, center on playhead
    const newDuration = Math.max(2000, viewport.viewportDuration / 1.3);
    const playheadRatio = (currentTimeMs - viewport.viewStart) / viewport.viewportDuration;

    // Keep playhead at same screen position
    const newViewStart = currentTimeMs - playheadRatio * newDuration;
    const clampedViewStart = Math.max(0, Math.min(newViewStart, durationMs - newDuration));

    viewport.setViewportDuration(newDuration);
    viewport.setViewStart(clampedViewStart);
  };

  const handleZoomOut = () => {
    if (durationMs === 0 || viewport.viewportDuration === 0) return;

    // Increase viewport by 30%, center on playhead
    const newDuration = Math.min(durationMs, viewport.viewportDuration * 1.3);
    const playheadRatio = (currentTimeMs - viewport.viewStart) / viewport.viewportDuration;

    // Keep playhead at same screen position
    const newViewStart = currentTimeMs - playheadRatio * newDuration;
    const clampedViewStart = Math.max(0, Math.min(newViewStart, durationMs - newDuration));

    viewport.setViewportDuration(newDuration);
    viewport.setViewStart(clampedViewStart);
  };

  const handleZoomFit = () => {
    if (durationMs === 0) return;

    // Reset to show entire script
    viewport.setViewportDuration(durationMs);
    viewport.setViewStart(0);
  };

  // Empty state (only in read-only mode)
  if (actions.length === 0 && !isEditMode) {
    return (
      <div
        ref={containerRef}
        className="bg-card border border-muted rounded-lg overflow-hidden"
      >
        <div
          className="flex items-center justify-center text-muted-foreground"
          style={{ height: CANVAS_HEIGHT }}
        >
          Load a funscript to see the timeline
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-card border border-muted rounded-lg overflow-hidden">
      <TimelineControls
        showActionPoints={isEditMode || showActionPoints}
        onToggleActionPoints={() => setShowActionPoints(!showActionPoints)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        editMode={editor?.mode}
        onEditModeChange={editor?.setMode}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExport={onExport}
        selectedCount={editor?.selectedIndices.size ?? 0}
        onDeleteSelected={editor?.deleteSelected}
      />

      <div className="relative" style={{ height: CANVAS_HEIGHT }}>
        {/* Canvas for area chart */}
        {containerWidth > 0 && (
          <TimelineCanvas
            actions={actions}
            viewStart={viewport.viewStart}
            viewEnd={viewport.viewEnd}
            showActionPoints={isEditMode || showActionPoints}
            width={containerWidth}
            height={CANVAS_HEIGHT}
          />
        )}

        {/* Editor overlay (in edit mode) */}
        {isEditMode && editor && containerWidth > 0 && (
          <TimelineEditorOverlay
            actions={actions}
            viewStart={viewport.viewStart}
            viewEnd={viewport.viewEnd}
            width={containerWidth}
            height={CANVAS_HEIGHT}
            selectedIndices={editor.selectedIndices}
            hoveredIndex={editor.hoveredIndex}
            isDragging={editor.isDragging}
            dragPreview={editor.dragPreview}
            mode={editor.mode}
            drawPoints={editor.drawPoints}
            selectionRect={editor.selectionRect}
          />
        )}

        {/* Playhead overlay */}
        {containerWidth > 0 && (
          <PlayheadOverlay
            currentTimeMs={currentTimeMs}
            viewStart={viewport.viewStart}
            viewEnd={viewport.viewEnd}
            width={containerWidth}
            height={CANVAS_HEIGHT}
            actions={actions}
          />
        )}

        {/* Interaction layer */}
        <div
          className="absolute inset-0 cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {containerWidth > 0 && (
        <TimelineAxis
          viewStart={viewport.viewStart}
          viewEnd={viewport.viewEnd}
          width={containerWidth}
        />
      )}
    </div>
  );
}
