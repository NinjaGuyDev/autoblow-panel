import type { FunscriptAction } from '@/types/funscript';
import type { WaypointDefinition } from '@/types/patterns';
import { easingFunctions } from '@/lib/easing';

/**
 * Converts a sequence of waypoints to a FunscriptAction array
 *
 * Each waypoint defines a control point with position, time, and interpolation type.
 * The interpolation type determines how motion is generated from that waypoint to the next.
 *
 * @param waypoints - Array of waypoint definitions
 * @returns Array of FunscriptAction objects sorted by time
 *
 * @example
 * ```ts
 * const waypoints = [
 *   { pos: 0, timeMs: 0, interpolation: 'linear' },
 *   { pos: 100, timeMs: 1000, interpolation: 'easeOut' },
 *   { pos: 0, timeMs: 2000, interpolation: 'linear' }
 * ];
 * const actions = waypointsToActions(waypoints);
 * ```
 */
export function waypointsToActions(waypoints: WaypointDefinition[]): FunscriptAction[] {
  // Edge case: empty or single waypoint
  if (waypoints.length === 0) {
    return [];
  }

  if (waypoints.length === 1) {
    return [{ pos: waypoints[0].pos, at: waypoints[0].timeMs }];
  }

  const actions: FunscriptAction[] = [];

  // Process each segment (from waypoint i to waypoint i+1)
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];

    // Special case: step interpolation - emit only the start point
    if (start.interpolation === 'step') {
      actions.push({ pos: start.pos, at: start.timeMs });
      continue;
    }

    // Get the easing function for this segment
    const easingFn = easingFunctions[start.interpolation];

    // Calculate distance and determine sample count
    const distance = Math.abs(end.pos - start.pos);
    // Use distance-based sampling: ~1 sample per 10 units of position
    const sampleCount = Math.max(2, Math.ceil(distance / 10));

    // Generate interpolated actions for this segment
    for (let j = 0; j < sampleCount; j++) {
      // Normalize time: t ∈ [0, 1]
      const t = j / (sampleCount - 1);

      // Apply easing function
      const easedT = easingFn(t);

      // Interpolate position
      const pos = start.pos + easedT * (end.pos - start.pos);

      // Interpolate time
      const at = start.timeMs + t * (end.timeMs - start.timeMs);

      actions.push({ pos: Math.round(pos), at: Math.round(at) });
    }
  }

  // Always include the final waypoint (may be duplicate from last segment, filter below)
  const lastWaypoint = waypoints[waypoints.length - 1];
  actions.push({ pos: lastWaypoint.pos, at: lastWaypoint.timeMs });

  // Remove duplicate time values (keep last occurrence)
  const uniqueActions: FunscriptAction[] = [];
  const seenTimes = new Set<number>();

  // Iterate backwards to keep last occurrence of each time
  for (let i = actions.length - 1; i >= 0; i--) {
    if (!seenTimes.has(actions[i].at)) {
      seenTimes.add(actions[i].at);
      uniqueActions.unshift(actions[i]);
    }
  }

  return uniqueActions;
}
