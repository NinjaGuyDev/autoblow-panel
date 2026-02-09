import { useEffect, useMemo } from 'react';
import type { WaypointDefinition, InterpolationType } from '@/types/patterns';
import type { FunscriptAction } from '@/types/funscript';
import { PatternDialogShell } from './PatternDialogShell';
import { usePatternCanvas } from './usePatternCanvas';
import {
  CANVAS_HEIGHT,
  DRAW_AREA_HEIGHT,
  computeTimeRange,
  dataToPixel,
  pixelToData,
  pointerToCanvasPixel,
  pointDistance,
  drawGrid,
  drawTimeAxis,
} from './patternCanvasUtils';

interface WaypointBuilderDialogProps {
  waypoints: WaypointDefinition[];
  patternName: string;
  selectedIndex: number | null;
  isOpen: boolean;
  isSaving: boolean;
  saveError: string | null;
  isDemoPlaying: boolean;
  demoError: string | null;
  canAddWaypoint: boolean;
  canRemoveWaypoint: boolean;
  totalDurationMs: number;
  isDeviceConnected: boolean;
  onClose: () => void;
  onPatternNameChange: (name: string) => void;
  onAddWaypoint: (pos: number, timeMs: number) => void;
  onUpdateWaypoint: (index: number, updates: Partial<WaypointDefinition>) => void;
  onRemoveWaypoint: (index: number) => void;
  onSelectWaypoint: (index: number | null) => void;
  onGenerateActions: () => FunscriptAction[];
  onStartDemo: () => void;
  onStopDemo: () => void;
  onSave: () => void;
}

const WAYPOINT_RADIUS = 8;
const HIT_RADIUS = 12;

/**
 * Full-screen modal dialog for waypoint-based pattern creation.
 * Features interactive canvas with draggable diamond waypoints,
 * interpolation controls, demo, and save.
 */
export function WaypointBuilderDialog({
  waypoints,
  patternName,
  selectedIndex,
  isOpen,
  isSaving,
  saveError,
  isDemoPlaying,
  demoError,
  canAddWaypoint,
  canRemoveWaypoint,
  totalDurationMs,
  isDeviceConnected,
  onClose,
  onPatternNameChange,
  onAddWaypoint,
  onUpdateWaypoint,
  onRemoveWaypoint,
  onSelectWaypoint,
  onGenerateActions,
  onStartDemo,
  onStopDemo,
  onSave,
}: WaypointBuilderDialogProps) {
  const { canvasRef, containerRef, canvasWidth, draggedIndex, setDraggedIndex } =
    usePatternCanvas();

  const generatedActions = useMemo(() => onGenerateActions(), [waypoints, onGenerateActions]);

  // --- Canvas drawing ---

  const drawPattern = () => {
    const canvas = canvasRef.current;
    if (!canvas || waypoints.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width);

    const tr = computeTimeRange(waypoints.map((w) => w.timeMs));

    // Generated actions as dashed warm amber line
    if (generatedActions.length > 0) {
      ctx.strokeStyle = '#c8956c'; // warm amber
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();

      generatedActions.forEach((action, i) => {
        const { x, y } = dataToPixel(action.at, action.pos, tr, canvas.width);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Waypoints as amber diamonds
    waypoints.forEach((waypoint, index) => {
      const { x, y } = dataToPixel(waypoint.timeMs, waypoint.pos, tr, canvas.width);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);

      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.fillRect(-WAYPOINT_RADIUS, -WAYPOINT_RADIUS, WAYPOINT_RADIUS * 2, WAYPOINT_RADIUS * 2);

      if (index === selectedIndex) {
        ctx.strokeStyle = '#22d3ee'; // cyan-400
        ctx.lineWidth = 2;
        ctx.strokeRect(
          -WAYPOINT_RADIUS - 1,
          -WAYPOINT_RADIUS - 1,
          WAYPOINT_RADIUS * 2 + 2,
          WAYPOINT_RADIUS * 2 + 2,
        );
      }

      ctx.restore();

      // Index label centered in diamond
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), x, y);
    });

    drawTimeAxis(ctx, tr, canvas.width);
  };

  useEffect(() => {
    if (isOpen) drawPattern();
  }, [waypoints, selectedIndex, generatedActions, canvasWidth, isOpen]);

  // --- Pointer handlers ---

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = pointerToCanvasPixel(e.clientX, e.clientY, canvas);
    const tr = computeTimeRange(waypoints.map((w) => w.timeMs));

    let hitWaypoint = false;

    for (let i = 0; i < waypoints.length; i++) {
      const pt = dataToPixel(waypoints[i].timeMs, waypoints[i].pos, tr, canvas.width);
      if (pointDistance(x, y, pt.x, pt.y) <= HIT_RADIUS) {
        onSelectWaypoint(i);
        setDraggedIndex(i);
        canvas.setPointerCapture(e.pointerId);
        hitWaypoint = true;
        break;
      }
    }

    if (!hitWaypoint && canAddWaypoint && y <= DRAW_AREA_HEIGHT) {
      const data = pixelToData(x, y, tr, canvas.width);
      onAddWaypoint(data.pos, data.time);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (draggedIndex === null || !canvas) return;

    const { x, y } = pointerToCanvasPixel(e.clientX, e.clientY, canvas);
    const tr = computeTimeRange(waypoints.map((w) => w.timeMs));
    const data = pixelToData(x, y, tr, canvas.width);

    onUpdateWaypoint(draggedIndex, { pos: data.pos, timeMs: data.time });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedIndex !== null && canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
      setDraggedIndex(null);
    }
  };

  // --- Save handler (closes dialog after save) ---

  const handleSave = async () => {
    await onSave();
    onClose();
  };

  if (!isOpen) return null;

  const selectedWaypoint = selectedIndex !== null ? waypoints[selectedIndex] : null;

  return (
    <PatternDialogShell
      onClose={onClose}
      onSave={handleSave}
      isSaving={isSaving}
      saveError={saveError}
      isDemoPlaying={isDemoPlaying}
      demoError={demoError}
      isDeviceConnected={isDeviceConnected}
      onStartDemo={onStartDemo}
      onStopDemo={onStopDemo}
      header={
        <div>
          <label className="text-xs text-stone-500 block mb-1">Pattern Name</label>
          <input
            type="text"
            value={patternName}
            onChange={(e) => onPatternNameChange(e.target.value)}
            className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-700/40"
          />
        </div>
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

      {/* Selected waypoint controls */}
      {selectedWaypoint !== null && selectedIndex !== null && (
        <div className="mb-4 p-4 rounded bg-stone-800 border border-stone-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-stone-500 block mb-1">
                Point {selectedIndex + 1}
              </label>
              <div className="px-3 py-2 rounded bg-stone-900 border border-stone-700 text-white text-sm">
                pos={selectedWaypoint.pos}, time={selectedWaypoint.timeMs}ms
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Interpolation</label>
              <select
                value={selectedWaypoint.interpolation}
                onChange={(e) =>
                  onUpdateWaypoint(selectedIndex, {
                    interpolation: e.target.value as InterpolationType,
                  })
                }
                disabled={selectedIndex === 0}
                title={
                  selectedIndex === 0 ? 'First waypoint has no preceding segment' : undefined
                }
                className="w-full px-3 py-2 rounded bg-stone-900 border border-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="linear">Linear</option>
                <option value="easeIn">Ease In</option>
                <option value="easeOut">Ease Out</option>
                <option value="easeInOut">Ease In/Out</option>
                <option value="step">Step</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => onRemoveWaypoint(selectedIndex)}
            disabled={!canRemoveWaypoint}
            className="mt-3 px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Remove Point
          </button>
        </div>
      )}

      {/* Info bar */}
      <div className="mb-4 px-3 py-2 rounded bg-stone-800 border border-stone-700 text-sm text-stone-300">
        {waypoints.length} waypoints | Duration:{' '}
        <span style={{ fontFamily: 'var(--font-mono)' }}>{(totalDurationMs / 1000).toFixed(1)}s</span> |{' '}
        {generatedActions.length} action points
      </div>
    </PatternDialogShell>
  );
}
