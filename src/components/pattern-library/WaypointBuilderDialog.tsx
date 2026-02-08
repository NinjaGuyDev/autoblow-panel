import { useEffect, useRef, useState, useMemo } from 'react';
import type { WaypointDefinition, InterpolationType } from '@/types/patterns';
import type { FunscriptAction } from '@/types/funscript';
import { cn } from '@/lib/utils';

interface WaypointBuilderDialogProps {
  // State from useWaypointBuilder hook
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

  // Methods from useWaypointBuilder hook
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

/**
 * Full-screen modal dialog for waypoint-based pattern creation
 * Features interactive canvas with draggable diamond waypoints, interpolation controls, demo, and save
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  // Canvas dimensions
  const CANVAS_HEIGHT = 220;
  const DRAW_AREA_HEIGHT = 190;
  const LABEL_AREA_TOP = 195;
  const WAYPOINT_RADIUS = 8; // Diamond radius (rotated square)
  const HIT_RADIUS = 12; // Hit test radius

  // Memoize generated actions to avoid regenerating on every render
  const generatedActions = useMemo(() => onGenerateActions(), [waypoints, onGenerateActions]);

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
  const drawPattern = () => {
    const canvas = canvasRef.current;
    if (!canvas || waypoints.length === 0) return;

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
      const y = DRAW_AREA_HEIGHT - (pos / 100) * DRAW_AREA_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // Calculate time scale
    const maxTime = Math.max(...waypoints.map((w) => w.timeMs));
    const minTime = Math.min(...waypoints.map((w) => w.timeMs));
    const timeRange = maxTime - minTime || 1;

    // Draw generated actions as dashed purple line
    if (generatedActions.length > 0) {
      ctx.strokeStyle = '#a78bfa'; // purple-400
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();

      generatedActions.forEach((action, i) => {
        const x = ((action.at - minTime) / timeRange) * canvas.width;
        const y = DRAW_AREA_HEIGHT - (action.pos / 100) * DRAW_AREA_HEIGHT;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw waypoints as filled amber diamonds (rotated squares)
    waypoints.forEach((waypoint, index) => {
      const x = ((waypoint.timeMs - minTime) / timeRange) * canvas.width;
      const y = DRAW_AREA_HEIGHT - (waypoint.pos / 100) * DRAW_AREA_HEIGHT;

      // Draw diamond (rotated 45 degrees square)
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);

      // Fill diamond
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.fillRect(-WAYPOINT_RADIUS, -WAYPOINT_RADIUS, WAYPOINT_RADIUS * 2, WAYPOINT_RADIUS * 2);

      // Draw selection ring if selected
      if (index === selectedIndex) {
        ctx.strokeStyle = '#22d3ee'; // cyan-400
        ctx.lineWidth = 2;
        ctx.strokeRect(-WAYPOINT_RADIUS - 1, -WAYPOINT_RADIUS - 1, WAYPOINT_RADIUS * 2 + 2, WAYPOINT_RADIUS * 2 + 2);
      }

      ctx.restore();

      // Draw index label (1-based) centered in diamond
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), x, y);
    });

    // Draw time axis labels
    ctx.fillStyle = '#a1a1aa'; // zinc-400
    ctx.font = '11px monospace';
    ctx.textBaseline = 'top';

    // Draw evenly spaced time markers
    const totalSeconds = timeRange / 1000;
    const tickCount = Math.min(Math.max(3, Math.ceil(totalSeconds)), 8);

    for (let i = 0; i <= tickCount; i++) {
      const fraction = i / tickCount;
      const x = fraction * canvas.width;
      const timeAtTick = minTime + fraction * timeRange;
      const label = (timeAtTick / 1000).toFixed(1) + 's';

      // Align text: left for first, right for last, center for middle
      if (i === 0) {
        ctx.textAlign = 'left';
      } else if (i === tickCount) {
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'center';
      }

      ctx.fillText(label, x, LABEL_AREA_TOP);
    }
  };

  // Redraw when waypoints or canvas size changes
  useEffect(() => {
    if (isOpen) {
      drawPattern();
    }
  }, [waypoints, selectedIndex, generatedActions, canvasWidth, isOpen]);

  // Handle pointer down - select or start drag
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Hit test against all waypoints
    const maxTime = Math.max(...waypoints.map((w) => w.timeMs));
    const minTime = Math.min(...waypoints.map((w) => w.timeMs));
    const timeRange = maxTime - minTime || 1;

    let hitWaypoint = false;

    for (let i = 0; i < waypoints.length; i++) {
      const waypoint = waypoints[i];
      const wx = ((waypoint.timeMs - minTime) / timeRange) * canvas.width;
      const wy = DRAW_AREA_HEIGHT - (waypoint.pos / 100) * DRAW_AREA_HEIGHT;

      const distance = Math.sqrt((x - wx) ** 2 + (y - wy) ** 2);

      if (distance <= HIT_RADIUS) {
        onSelectWaypoint(i);
        setDraggedIndex(i);
        canvas.setPointerCapture(e.pointerId);
        hitWaypoint = true;
        break;
      }
    }

    // If no waypoint hit, add a new one if possible
    if (!hitWaypoint && canAddWaypoint && y <= DRAW_AREA_HEIGHT) {
      const newTimeMs = minTime + (x / canvas.width) * timeRange;
      const newPos = 100 - (y / DRAW_AREA_HEIGHT) * 100;
      onAddWaypoint(newPos, newTimeMs);
    }
  };

  // Handle pointer move - update dragged waypoint
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedIndex === null || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Calculate time scale
    const maxTime = Math.max(...waypoints.map((w) => w.timeMs));
    const minTime = Math.min(...waypoints.map((w) => w.timeMs));
    const timeRange = maxTime - minTime || 1;

    // Calculate new time (clamped to time range)
    const newTimeMs = Math.max(
      minTime,
      Math.min(maxTime, minTime + (x / canvas.width) * timeRange)
    );

    // Calculate new position (clamped to 0-100)
    const newPos = Math.max(
      0,
      Math.min(100, 100 - (y / DRAW_AREA_HEIGHT) * 100)
    );

    // Update waypoint
    onUpdateWaypoint(draggedIndex, { pos: newPos, timeMs: newTimeMs });
  };

  // Handle pointer up - end drag
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedIndex !== null && canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
      setDraggedIndex(null);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle save
  const handleSave = async () => {
    await onSave();
    // Close dialog after successful save
    onClose();
  };

  if (!isOpen) return null;

  const selectedWaypoint = selectedIndex !== null ? waypoints[selectedIndex] : null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">
              Pattern Name
            </label>
            <input
              type="text"
              value={patternName}
              onChange={(e) => onPatternNameChange(e.target.value)}
              className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors mt-5"
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

        {/* Selected waypoint controls */}
        {selectedWaypoint !== null && selectedIndex !== null && (
          <div className="mb-4 p-4 rounded bg-zinc-800 border border-zinc-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Waypoint info */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Point {selectedIndex + 1}
                </label>
                <div className="px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white text-sm">
                  pos={selectedWaypoint.pos}, time={selectedWaypoint.timeMs}ms
                </div>
              </div>

              {/* Interpolation dropdown */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Interpolation
                </label>
                <select
                  value={selectedWaypoint.interpolation}
                  onChange={(e) =>
                    onUpdateWaypoint(selectedIndex, {
                      interpolation: e.target.value as InterpolationType,
                    })
                  }
                  disabled={selectedIndex === 0}
                  title={
                    selectedIndex === 0
                      ? 'First waypoint has no preceding segment'
                      : undefined
                  }
                  className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="step">Step</option>
                </select>
              </div>
            </div>

            {/* Remove button */}
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
        <div className="mb-4 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm text-zinc-300">
          {waypoints.length} waypoints | Duration: {(totalDurationMs / 1000).toFixed(1)}s | {generatedActions.length} action points
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
            onClick={handleSave}
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
