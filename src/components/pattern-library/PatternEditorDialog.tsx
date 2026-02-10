import { useEffect } from 'react';
import type { FunscriptAction } from '@/types/funscript';
import type { CustomPatternDefinition } from '@/types/patterns';
import { PatternDialogShell } from './PatternDialogShell';
import { usePatternCanvas } from './usePatternCanvas';
import {
  CANVAS_HEIGHT,
  computeTimeRange,
  dataToPixel,
  pixelToData,
  pointerToCanvasPixel,
  pointDistance,
  drawGrid,
  drawTimeAxis,
} from './patternCanvasUtils';

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

const POINT_RADIUS = 6;
const HIT_RADIUS = 8;

/**
 * Full-screen modal dialog for editing custom patterns.
 * Features draggable action points, duration/intensity controls, demo, and save.
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
  const { canvasRef, containerRef, canvasWidth, draggedIndex, setDraggedIndex } =
    usePatternCanvas();

  // --- Canvas drawing ---

  const drawPattern = (actions: FunscriptAction[]) => {
    const canvas = canvasRef.current;
    if (!canvas || actions.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width);

    const tr = computeTimeRange(actions.map((a) => a.at));

    // Solid warm amber pattern line
    ctx.strokeStyle = '#c8956c'; // warm amber
    ctx.lineWidth = 3;
    ctx.beginPath();

    actions.forEach((action, i) => {
      const { x, y } = dataToPixel(action.at, action.pos, tr, canvas.width);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Action points as warm amber circles
    ctx.fillStyle = '#c8956c'; // warm amber
    actions.forEach((action) => {
      const { x, y } = dataToPixel(action.at, action.pos, tr, canvas.width);
      ctx.beginPath();
      ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    drawTimeAxis(ctx, tr, canvas.width);
  };

  useEffect(() => {
    if (pattern) drawPattern(pattern.actions);
  }, [pattern, canvasWidth]);

  // --- Pointer handlers ---

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!pattern || !canvas) return;

    const { x, y } = pointerToCanvasPixel(e.clientX, e.clientY, canvas);
    const tr = computeTimeRange(pattern.actions.map((a) => a.at));

    for (let i = 0; i < pattern.actions.length; i++) {
      const pt = dataToPixel(pattern.actions[i].at, pattern.actions[i].pos, tr, canvas.width);
      if (pointDistance(x, y, pt.x, pt.y) <= HIT_RADIUS) {
        setDraggedIndex(i);
        canvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (draggedIndex === null || !pattern || !canvas) return;

    const { x, y } = pointerToCanvasPixel(e.clientX, e.clientY, canvas);
    const tr = computeTimeRange(pattern.actions.map((a) => a.at));
    const data = pixelToData(x, y, tr, canvas.width);

    const updatedActions = pattern.actions.map((action, i) => {
      if (i === draggedIndex) {
        return { at: Math.round(data.time), pos: Math.round(data.pos) };
      }
      return action;
    });

    updatedActions.sort((a, b) => a.at - b.at);
    onActionsChange(updatedActions);
    drawPattern(updatedActions);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedIndex !== null && canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
      setDraggedIndex(null);
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) onDurationChange(value);
  };

  if (!isOpen || !pattern) return null;

  return (
    <PatternDialogShell
      onClose={onClose}
      onSave={onSave}
      isSaving={isSaving}
      saveError={saveError}
      isDemoPlaying={isDemoPlaying}
      demoError={demoError}
      isDeviceConnected={isDeviceConnected}
      onStartDemo={onStartDemo}
      onStopDemo={onStopDemo}
      header={
        <h2 className="text-xl font-semibold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>{pattern.name}</h2>
      }
    >
      {/* Canvas */}
      <div ref={containerRef} className="mb-4">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={CANVAS_HEIGHT}
          className="w-full h-auto rounded border border-stone-700 bg-stone-950 cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs text-stone-500 block mb-1">Duration (s)</label>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="300"
            value={(pattern.durationMs / 1000).toFixed(1)}
            onChange={handleDurationChange}
            className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-700/40"
          />
        </div>

        <div>
          <label className="text-xs text-stone-500 block mb-1">Intensity</label>
          <div className="flex gap-2">
            <button
              onClick={() => onIntensityChange(-10)}
              className="flex-1 px-3 py-2 rounded bg-stone-800 border border-stone-700 text-white hover:bg-stone-700 transition-colors"
            >
              - Intensity
            </button>
            <button
              onClick={() => onIntensityChange(10)}
              className="flex-1 px-3 py-2 rounded bg-stone-800 border border-stone-700 text-white hover:bg-stone-700 transition-colors"
            >
              + Intensity
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-stone-500 block mb-1">Action Points</label>
          <div className="px-3 py-2 rounded bg-stone-800 border border-stone-700 text-white">
            {pattern.actions.length}
          </div>
        </div>
      </div>
    </PatternDialogShell>
  );
}
