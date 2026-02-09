/**
 * Shared canvas drawing and coordinate utilities for pattern editor dialogs.
 * Pure functions — no React dependency.
 */

/** Canvas layout constants */
export const CANVAS_HEIGHT = 220;
export const DRAW_AREA_HEIGHT = 190;
export const LABEL_AREA_TOP = 195;

/** Min/max/range computed from a set of time values */
export interface TimeRange {
  minTime: number;
  maxTime: number;
  range: number;
}

/**
 * Compute min, max, and range from an array of time values.
 * Range is at least 1 to prevent division by zero.
 */
export function computeTimeRange(times: number[]): TimeRange {
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  return { minTime, maxTime, range: maxTime - minTime || 1 };
}

/**
 * Convert a data-space (time, position) pair to canvas pixel coordinates.
 */
export function dataToPixel(
  time: number,
  pos: number,
  tr: TimeRange,
  canvasWidth: number,
): { x: number; y: number } {
  return {
    x: ((time - tr.minTime) / tr.range) * canvasWidth,
    y: DRAW_AREA_HEIGHT - (pos / 100) * DRAW_AREA_HEIGHT,
  };
}

/**
 * Convert canvas pixel coordinates to data-space (time, position).
 * Time is clamped to the given range; position is clamped to 0-100.
 */
export function pixelToData(
  px: number,
  py: number,
  tr: TimeRange,
  canvasWidth: number,
): { time: number; pos: number } {
  const time = Math.max(
    tr.minTime,
    Math.min(tr.maxTime, tr.minTime + (px / canvasWidth) * tr.range),
  );
  const pos = Math.max(0, Math.min(100, 100 - (py / DRAW_AREA_HEIGHT) * 100));
  return { time, pos };
}

/**
 * Convert pointer event client coordinates to canvas pixel coordinates,
 * accounting for CSS scaling (logical canvas width vs displayed width).
 */
export function pointerToCanvasPixel(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

/**
 * Draw dashed horizontal grid lines at 0%, 25%, 50%, 75%, 100% positions.
 */
export function drawGrid(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
  ctx.strokeStyle = '#44403c'; // stone-700
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  [0, 25, 50, 75, 100].forEach((pos) => {
    const y = DRAW_AREA_HEIGHT - (pos / 100) * DRAW_AREA_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  });

  ctx.setLineDash([]);
}

/**
 * Draw evenly-spaced time axis labels below the drawing area.
 */
export function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  tr: TimeRange,
  canvasWidth: number,
): void {
  ctx.fillStyle = '#a8a29e'; // stone-400
  ctx.font = '11px monospace';
  ctx.textBaseline = 'top';

  const totalSeconds = tr.range / 1000;
  const tickCount = Math.min(Math.max(3, Math.ceil(totalSeconds)), 8);

  for (let i = 0; i <= tickCount; i++) {
    const fraction = i / tickCount;
    const x = fraction * canvasWidth;
    const label = ((tr.minTime + fraction * tr.range) / 1000).toFixed(1) + 's';

    if (i === 0) {
      ctx.textAlign = 'left';
    } else if (i === tickCount) {
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'center';
    }

    ctx.fillText(label, x, LABEL_AREA_TOP);
  }
}

/**
 * Euclidean distance between two points.
 */
export function pointDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
