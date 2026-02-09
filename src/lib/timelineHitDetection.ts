import type { FunscriptAction } from '@/types/funscript';
import type { HitTestResult, SelectionRect } from '@/types/timeline';

export const HIT_RADIUS_PX = 8;
export const TOP_PADDING = 20;
export const BOTTOM_PADDING = 30;

/**
 * Maps timestamp to x pixel coordinate
 */
export function timeToX(
  timeMs: number,
  viewStart: number,
  viewEnd: number,
  canvasWidth: number
): number {
  const ratio = (timeMs - viewStart) / (viewEnd - viewStart);
  return ratio * canvasWidth;
}

/**
 * Maps position (0-100) to y pixel coordinate
 */
export function posToY(pos: number, canvasHeight: number): number {
  const chartHeight = canvasHeight - TOP_PADDING - BOTTOM_PADDING;
  return TOP_PADDING + chartHeight * (1 - pos / 100);
}

/**
 * Maps x pixel coordinate to timestamp
 */
export function xToTime(
  x: number,
  viewStart: number,
  viewEnd: number,
  canvasWidth: number
): number {
  const ratio = x / canvasWidth;
  return viewStart + ratio * (viewEnd - viewStart);
}

/**
 * Maps y pixel coordinate to position (0-100), clamped
 */
export function yToPos(y: number, canvasHeight: number): number {
  const chartHeight = canvasHeight - TOP_PADDING - BOTTOM_PADDING;
  const normalizedY = (y - TOP_PADDING) / chartHeight;
  const pos = (1 - normalizedY) * 100;
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, pos));
}

/**
 * Finds the nearest action point within HIT_RADIUS_PX
 * Returns null if no point is close enough
 */
export function hitTestActionPoint(
  mouseX: number,
  mouseY: number,
  actions: FunscriptAction[],
  viewStart: number,
  viewEnd: number,
  canvasWidth: number,
  canvasHeight: number
): HitTestResult | null {
  let closestResult: HitTestResult | null = null;
  let closestDistance = HIT_RADIUS_PX;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Only check actions within the visible viewport
    if (action.at < viewStart || action.at > viewEnd) {
      continue;
    }

    const x = timeToX(action.at, viewStart, viewEnd, canvasWidth);
    const y = posToY(action.pos, canvasHeight);

    const dx = mouseX - x;
    const dy = mouseY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestResult = {
        index: i,
        action: { pos: action.pos, at: action.at },
        distancePx: distance,
      };
    }
  }

  return closestResult;
}

/**
 * Returns indices of all action points whose rendered position falls within the selection rectangle
 */
export function getPointsInRect(
  rect: SelectionRect,
  actions: FunscriptAction[],
  viewStart: number,
  viewEnd: number,
  canvasWidth: number,
  canvasHeight: number
): number[] {
  const indices: number[] = [];

  // Normalize rect to ensure startX/Y <= endX/Y
  const minX = Math.min(rect.startX, rect.endX);
  const maxX = Math.max(rect.startX, rect.endX);
  const minY = Math.min(rect.startY, rect.endY);
  const maxY = Math.max(rect.startY, rect.endY);

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Only check actions within the visible viewport
    if (action.at < viewStart || action.at > viewEnd) {
      continue;
    }

    const x = timeToX(action.at, viewStart, viewEnd, canvasWidth);
    const y = posToY(action.pos, canvasHeight);

    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      indices.push(i);
    }
  }

  return indices;
}
