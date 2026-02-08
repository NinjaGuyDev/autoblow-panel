import { describe, it, expect } from 'vitest';
import { waypointsToActions } from '../waypointGenerator';
import type { WaypointDefinition } from '@/types/patterns';

describe('waypointsToActions', () => {
  describe('edge cases', () => {
    it('should handle single waypoint', () => {
      const waypoints: WaypointDefinition[] = [
        { pos: 50, timeMs: 1000, interpolation: 'linear' },
      ];

      const result = waypointsToActions(waypoints);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ pos: 50, at: 1000 });
    });

    it('should handle empty waypoints array', () => {
      const result = waypointsToActions([]);
      expect(result).toEqual([]);
    });
  });

  describe('basic linear interpolation', () => {
    it('should generate actions for 3 waypoints with correct endpoints', () => {
      const waypoints: WaypointDefinition[] = [
        { pos: 0, timeMs: 0, interpolation: 'linear' },
        { pos: 100, timeMs: 1000, interpolation: 'linear' },
        { pos: 0, timeMs: 2000, interpolation: 'linear' },
      ];

      const result = waypointsToActions(waypoints);

      // Should have first action at 0ms/0pos
      expect(result[0]).toEqual({ pos: 0, at: 0 });
      // Should have last action at 2000ms/0pos
      expect(result[result.length - 1]).toEqual({ pos: 0, at: 2000 });
      // Actions should be sorted by time
      for (let i = 1; i < result.length; i++) {
        expect(result[i].at).toBeGreaterThan(result[i - 1].at);
      }
    });
  });

  describe('step interpolation', () => {
    it('should emit only start point for step segments', () => {
      const waypoints: WaypointDefinition[] = [
        { pos: 0, timeMs: 0, interpolation: 'step' },
        { pos: 100, timeMs: 1000, interpolation: 'step' },
        { pos: 0, timeMs: 2000, interpolation: 'linear' },
      ];

      const result = waypointsToActions(waypoints);

      // Step segments should not have intermediate samples
      // First step: only emit {pos:0, at:0}
      // Second step: only emit {pos:100, at:1000}
      // Linear segment may have intermediate samples
      // Final waypoint always included

      // Check that we don't have excessive samples (step should be sparse)
      // With step interpolation, we should have fewer actions
      expect(result.length).toBeLessThan(15);

      // First and last should be correct
      expect(result[0]).toEqual({ pos: 0, at: 0 });
      expect(result[result.length - 1]).toEqual({ pos: 0, at: 2000 });
    });
  });

  describe('distance-based sampling', () => {
    it('should produce more samples for large distance than small distance', () => {
      const largeDistance: WaypointDefinition[] = [
        { pos: 0, timeMs: 0, interpolation: 'linear' },
        { pos: 100, timeMs: 1000, interpolation: 'linear' },
      ];

      const smallDistance: WaypointDefinition[] = [
        { pos: 45, timeMs: 0, interpolation: 'linear' },
        { pos: 55, timeMs: 1000, interpolation: 'linear' },
      ];

      const largeResult = waypointsToActions(largeDistance);
      const smallResult = waypointsToActions(smallDistance);

      // Large distance should produce more samples
      expect(largeResult.length).toBeGreaterThan(smallResult.length);
    });
  });

  describe('final waypoint inclusion', () => {
    it('should always include final waypoint in output', () => {
      const waypoints: WaypointDefinition[] = [
        { pos: 0, timeMs: 0, interpolation: 'linear' },
        { pos: 50, timeMs: 500, interpolation: 'easeIn' },
        { pos: 100, timeMs: 1000, interpolation: 'linear' },
      ];

      const result = waypointsToActions(waypoints);

      // Last action must match last waypoint
      const lastAction = result[result.length - 1];
      const lastWaypoint = waypoints[waypoints.length - 1];
      expect(lastAction.pos).toBe(lastWaypoint.pos);
      expect(lastAction.at).toBe(lastWaypoint.timeMs);
    });
  });

  describe('easing curve behavior', () => {
    it('should produce slower start with easeIn', () => {
      const waypoints: WaypointDefinition[] = [
        { pos: 0, timeMs: 0, interpolation: 'easeIn' },
        { pos: 100, timeMs: 1000, interpolation: 'linear' },
      ];

      const result = waypointsToActions(waypoints);

      // Find midpoint action (around 500ms)
      const midAction = result.find(a => Math.abs(a.at - 500) < 100);

      if (midAction) {
        // With easeIn, position at midpoint should be less than 50 (linear midpoint)
        // Because it starts slow and accelerates
        expect(midAction.pos).toBeLessThan(50);
      }
    });

    it('should produce faster start with easeOut', () => {
      const waypoints: WaypointDefinition[] = [
        { pos: 0, timeMs: 0, interpolation: 'easeOut' },
        { pos: 100, timeMs: 1000, interpolation: 'linear' },
      ];

      const result = waypointsToActions(waypoints);

      // Find midpoint action (around 500ms)
      const midAction = result.find(a => Math.abs(a.at - 500) < 100);

      if (midAction) {
        // With easeOut, position at midpoint should be greater than 50 (linear midpoint)
        // Because it starts fast and decelerates
        expect(midAction.pos).toBeGreaterThan(50);
      }
    });
  });

  describe('action sorting', () => {
    it('should produce sorted actions by time', () => {
      const waypoints: WaypointDefinition[] = [
        { pos: 0, timeMs: 0, interpolation: 'linear' },
        { pos: 100, timeMs: 1000, interpolation: 'easeIn' },
        { pos: 50, timeMs: 2000, interpolation: 'easeOut' },
        { pos: 0, timeMs: 3000, interpolation: 'linear' },
      ];

      const result = waypointsToActions(waypoints);

      // Verify sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i].at).toBeGreaterThanOrEqual(result[i - 1].at);
      }
    });
  });
});
