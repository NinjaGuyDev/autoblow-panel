import React, { useMemo } from 'react';
import { timeToX, posToY } from '@/lib/timelineHitDetection';

interface PlayheadOverlayProps {
  currentTimeMs: number;
  viewStart: number;
  viewEnd: number;
  width: number;
  height: number;
  actions: Array<{ pos: number; at: number }>;
}

/**
 * Binary search to find the action closest to the given time
 */
export function findClosestAction(
  actions: Array<{ pos: number; at: number }>,
  timeMs: number
): { pos: number; at: number } | null {
  if (actions.length === 0) return null;

  let left = 0;
  let right = actions.length - 1;
  let closest = actions[0];
  let minDiff = Math.abs(actions[0].at - timeMs);

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const diff = Math.abs(actions[mid].at - timeMs);

    if (diff < minDiff) {
      minDiff = diff;
      closest = actions[mid];
    }

    if (actions[mid].at < timeMs) {
      left = mid + 1;
    } else if (actions[mid].at > timeMs) {
      right = mid - 1;
    } else {
      // Exact match
      return actions[mid];
    }
  }

  return closest;
}

export const PlayheadOverlay = React.memo<PlayheadOverlayProps>(
  ({ currentTimeMs, viewStart, viewEnd, width, height, actions }) => {
    // Calculate playhead X position
    const playheadX = useMemo(() => {
      if (currentTimeMs < viewStart || currentTimeMs > viewEnd) {
        return null; // Playhead not visible
      }
      return ((currentTimeMs - viewStart) / (viewEnd - viewStart)) * width;
    }, [currentTimeMs, viewStart, viewEnd, width]);

    // Find current action point
    const currentAction = useMemo(() => {
      return findClosestAction(actions, currentTimeMs);
    }, [actions, currentTimeMs]);

    // Calculate current action position if visible
    const currentActionPos = useMemo(() => {
      if (!currentAction) return null;
      if (currentAction.at < viewStart || currentAction.at > viewEnd) {
        return null; // Action not in viewport
      }
      return {
        x: timeToX(currentAction.at, viewStart, viewEnd, width),
        y: posToY(currentAction.pos, height),
      };
    }, [currentAction, viewStart, viewEnd, width, height]);

    if (!playheadX) return null;

    const amberGold = 'hsl(47, 100%, 60%)';

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={width}
        height={height}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/* Playhead line */}
        <line
          x1={playheadX}
          y1={0}
          x2={playheadX}
          y2={height}
          stroke={amberGold}
          strokeWidth={2.5}
          opacity={0.9}
        />

        {/* Playhead handle (triangle at top) */}
        <polygon
          points={`${playheadX - 6},0 ${playheadX + 6},0 ${playheadX},10`}
          fill={amberGold}
        />

        {/* Current action point highlight */}
        {currentActionPos && (
          <g>
            {/* Outer ring */}
            <circle
              cx={currentActionPos.x}
              cy={currentActionPos.y}
              r={8}
              fill="none"
              stroke={amberGold}
              strokeWidth={1.5}
              opacity={0.5}
            />
            {/* Inner dot */}
            <circle
              cx={currentActionPos.x}
              cy={currentActionPos.y}
              r={5}
              fill={amberGold}
            />
          </g>
        )}
      </svg>
    );
  }
);

PlayheadOverlay.displayName = 'PlayheadOverlay';
