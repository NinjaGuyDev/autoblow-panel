import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useTimelineViewport } from '@/hooks/useTimelineViewport';
import { useTimelineEditor } from '@/hooks/useTimelineEditor';
import { useValidation } from '@/hooks/useValidation';
import { useSmoothing } from '@/hooks/useSmoothing';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineEditorOverlay } from './TimelineEditorOverlay';
import { ValidationOverlay } from './ValidationOverlay';
import { SmoothingOverlay } from './SmoothingOverlay';
import { PlayheadOverlay } from './PlayheadOverlay';
import { TimelineAxis } from './TimelineAxis';
import { TimelineControls } from './TimelineControls';
import { TimelineSeekBar } from './TimelineSeekBar';
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

  // Validation state
  const validation = useValidation(actions as FunscriptAction[]);

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

  // Smoothing state (always call hook, but only active in edit mode)
  const smoothing = useSmoothing({
    actions,
    selectedIndices: editor?.selectedIndices ?? new Set(),
  });

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

  // Seek handler (used by seek bar)
  const handleSeek = (timeSeconds: number) => {
    onSeek(timeSeconds);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isEditMode && editor) {
      // Let editor handle it (select, draw, drag, etc.)
      editor.handleMouseDown(mouseX, mouseY, e);
    }
    // Panning is now handled by the seek bar, not the main canvas
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isEditMode && editor) {
      // Update editor state (hover, drag preview, etc.)
      editor.handleMouseMove(mouseX, mouseY);
    }
    // Panning is now handled by the seek bar, not the main canvas
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
      if (!wasDragging && !wasSelecting && durationMs > 0) {
        // Click-to-seek (simple click on empty space)
        const clickRatio = mouseX / containerWidth;
        const clickedTimeMs = viewport.viewStart + clickRatio * viewport.viewportDuration;
        const clampedTimeMs = Math.max(0, Math.min(clickedTimeMs, durationMs));
        const timeSeconds = clampedTimeMs / 1000;
        onSeek(timeSeconds);
      }
    }
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
    // No pan state to clean up - handled by seek bar
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
        className="bg-stone-900/50 border border-stone-800 rounded-lg overflow-hidden"
      >
        <div
          className="flex items-center justify-center text-stone-500"
          style={{ height: CANVAS_HEIGHT }}
        >
          Load a funscript to see the timeline
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-stone-900/50 border border-stone-800 rounded-lg overflow-hidden">
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
        validationSummary={validation.summary}
        smoothingActive={smoothing.smoothingActive}
        onSmoothingToggle={smoothing.smoothingActive ? smoothing.closeSmoothing : smoothing.openSmoothing}
        smoothingIntensity={smoothing.intensity}
        onSmoothingIntensityChange={smoothing.setIntensity}
        isPreviewActive={smoothing.isPreviewActive}
        onSmoothingPreview={smoothing.generatePreview}
        onSmoothingApply={() => {
          const result = smoothing.commitSmoothing();
          if (result) {
            onActionsChange?.(result);
          }
        }}
        onSmoothingCancel={smoothing.cancelPreview}
        smoothingStats={smoothing.stats}
        hasSelection={(editor?.selectedIndices.size ?? 0) > 0}
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

        {/* Validation overlay */}
        {containerWidth > 0 && validation.segments.length > 0 && (
          <ValidationOverlay
            actions={actions as FunscriptAction[]}
            segments={validation.segments}
            gaps={validation.gaps}
            viewStart={viewport.viewStart}
            viewEnd={viewport.viewEnd}
            width={containerWidth}
            height={CANVAS_HEIGHT}
          />
        )}

        {/* Smoothing overlay (preview) */}
        {smoothing.isPreviewActive && containerWidth > 0 && (
          <SmoothingOverlay
            smoothedActions={smoothing.previewActions}
            viewStart={viewport.viewStart}
            viewEnd={viewport.viewEnd}
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

      {/* Seek bar for panning and seeking */}
      {containerWidth > 0 && (
        <TimelineSeekBar
          durationMs={durationMs}
          currentTimeMs={currentTimeMs}
          viewStart={viewport.viewStart}
          viewEnd={viewport.viewEnd}
          width={containerWidth}
          onSeek={handleSeek}
          onPanStart={viewport.handlePanStart}
          onPanMove={viewport.handlePanMove}
          onPanEnd={viewport.handlePanEnd}
        />
      )}
    </div>
  );
}
