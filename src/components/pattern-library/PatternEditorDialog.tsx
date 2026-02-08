import { useEffect, useRef, useState } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { CustomPatternDefinition } from '@/types/patterns';
import { cn } from '@/lib/utils';

interface PatternEditorDialogProps {
  pattern: CustomPatternDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onActionsChange: (actions: FunscriptAction[]) => void;
  onDurationChange: (seconds: number) => void;
  onIntensityChange: (delta: number) => void;
  onStartDemo: () => void;
  onStopDemo: () => void;
  onSave: () => void;
  isDemoPlaying: boolean;
  demoError: string | null;
  isSaving: boolean;
  saveError: string | null;
  isDeviceConnected: boolean;
}

/**
 * Full-screen modal dialog for editing custom patterns
 * Features draggable action points, duration/intensity controls, demo, and save
 */
export function PatternEditorDialog({
  pattern,
  isOpen,
  onClose,
  onActionsChange,
  onDurationChange,
  onIntensityChange,
  onStartDemo,
  onStopDemo,
  onSave,
  isDemoPlaying,
  demoError,
  isSaving,
  saveError,
  isDeviceConnected,
}: PatternEditorDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  // Canvas height constant
  const CANVAS_HEIGHT = 200;
  const POINT_RADIUS = 6;
  const HIT_RADIUS = 8;

  // Resize canvas on container size change
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setCanvasWidth(width);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Draw pattern on canvas
  const drawPattern = (actions: FunscriptAction[]) => {
    const canvas = canvasRef.current;
    if (!canvas || actions.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#3f3f46'; // zinc-700
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Horizontal grid lines at 0, 25, 50, 75, 100
    [0, 25, 50, 75, 100].forEach((pos) => {
      const y = CANVAS_HEIGHT - (pos / 100) * CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // Calculate time scale
    const maxTime = Math.max(...actions.map((a) => a.at));
    const minTime = Math.min(...actions.map((a) => a.at));
    const timeRange = maxTime - minTime || 1;

    // Draw pattern line
    ctx.strokeStyle = '#8b5cf6'; // purple-500
    ctx.lineWidth = 3;
    ctx.beginPath();

    actions.forEach((action, i) => {
      const x = ((action.at - minTime) / timeRange) * canvas.width;
      const y = CANVAS_HEIGHT - (action.pos / 100) * CANVAS_HEIGHT;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw action points as circles
    ctx.fillStyle = '#8b5cf6'; // purple-500
    actions.forEach((action) => {
      const x = ((action.at - minTime) / timeRange) * canvas.width;
      const y = CANVAS_HEIGHT - (action.pos / 100) * CANVAS_HEIGHT;

      ctx.beginPath();
      ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Redraw when pattern or canvas size changes
  useEffect(() => {
    if (pattern && canvasRef.current) {
      drawPattern(pattern.actions);
    }
  }, [pattern, canvasWidth]);

  // Handle pointer down - start drag
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pattern || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Hit test against all points
    const actions = pattern.actions;
    const maxTime = Math.max(...actions.map((a) => a.at));
    const minTime = Math.min(...actions.map((a) => a.at));
    const timeRange = maxTime - minTime || 1;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const px = ((action.at - minTime) / timeRange) * canvas.width;
      const py = CANVAS_HEIGHT - (action.pos / 100) * CANVAS_HEIGHT;

      const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);

      if (distance <= HIT_RADIUS) {
        setDraggedIndex(i);
        canvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  };

  // Handle pointer move - update dragged point
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedIndex === null || !pattern || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert canvas coordinates to time/position
    const actions = pattern.actions;
    const maxTime = Math.max(...actions.map((a) => a.at));
    const minTime = Math.min(...actions.map((a) => a.at));
    const timeRange = maxTime - minTime || 1;

    // Calculate new time (clamped to time range)
    const newAt = Math.max(
      minTime,
      Math.min(maxTime, minTime + (x / canvas.width) * timeRange)
    );

    // Calculate new position (clamped to 0-100)
    const newPos = Math.max(
      0,
      Math.min(100, 100 - (y / CANVAS_HEIGHT) * 100)
    );

    // Update action
    const updatedActions = actions.map((action, i) => {
      if (i === draggedIndex) {
        return { at: Math.round(newAt), pos: Math.round(newPos) };
      }
      return action;
    });

    // Sort by time to maintain order
    updatedActions.sort((a, b) => a.at - b.at);

    // Update and redraw
    onActionsChange(updatedActions);
    drawPattern(updatedActions);
  };

  // Handle pointer up - end drag
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedIndex !== null && canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
      setDraggedIndex(null);
    }
  };

  // Handle duration change
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      onDurationChange(value);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !pattern) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">
            {pattern.name}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="mb-4">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={CANVAS_HEIGHT}
            className="w-full h-auto rounded border border-zinc-700 bg-zinc-950 cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Duration input */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Duration (s)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="300"
              value={(pattern.durationMs / 1000).toFixed(1)}
              onChange={handleDurationChange}
              className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Intensity buttons */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Intensity
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onIntensityChange(-10)}
                className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
              >
                - Intensity
              </button>
              <button
                onClick={() => onIntensityChange(10)}
                className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
              >
                + Intensity
              </button>
            </div>
          </div>

          {/* Actions count (read-only) */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Action Points
            </label>
            <div className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white">
              {pattern.actions.length}
            </div>
          </div>
        </div>

        {/* Error messages */}
        {demoError && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {demoError}
          </div>
        )}
        {saveError && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {saveError}
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-3">
          {isDeviceConnected && (
            <button
              onClick={isDemoPlaying ? onStopDemo : onStartDemo}
              className={cn(
                'px-4 py-2 rounded font-medium shadow-sm transition-colors',
                isDemoPlaying
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              )}
            >
              {isDemoPlaying ? 'Stop Demo' : 'Demo'}
            </button>
          )}

          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-zinc-600 text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
