#!/usr/bin/env python3
"""Verify the full strokes in the funscript"""

import json

def verify_full_strokes(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)

    actions = data['actions']

    # Find sequences that go through both extremes
    print("=== Full Stroke Detection ===\n")

    # Find all extreme positions with their timestamps
    extremes = [(i, a['at'], a['pos']) for i, a in enumerate(actions) if a['pos'] in [0, 100]]

    print(f"Found {len(extremes)} extreme positions:\n")

    # Look for complete full stroke cycles (2 consecutive extremes)
    full_strokes = []
    i = 0
    while i < len(extremes) - 2:
        idx1, time1, pos1 = extremes[i]
        idx2, time2, pos2 = extremes[i + 1]
        idx3, time3, pos3 = extremes[i + 2]

        # Check if this is a complete cycle (goes to one extreme, then the other)
        duration_total = (time3 - time1) / 1000
        if duration_total < 15 and pos1 != pos2 and pos2 != pos3:  # Complete cycle
            full_strokes.append({
                'start_time': time1 / 1000,
                'end_time': time3 / 1000,
                'duration': duration_total,
                'pattern': f"{pos1} → {pos2} → {pos3}"
            })
            print(f"Full stroke cycle at {time1/1000:.1f}s:")
            print(f"  {pos1} → {pos2} → {pos3}")
            print(f"  Total duration: {duration_total:.1f}s")
            print(f"  First half: {(time2-time1)/1000:.1f}s, Second half: {(time3-time2)/1000:.1f}s")
            print(f"  Action indices: {idx1} to {idx3}")
            print()
            i += 2  # Skip the next extreme as we've consumed it
        else:
            i += 1

    print(f"\nTotal full stroke patterns detected: {len(full_strokes)}")
    if full_strokes:
        avg_duration = sum(s['duration'] for s in full_strokes) / len(full_strokes)
        print(f"Average duration: {avg_duration:.1f}s (target: 5-6s per half, 10-12s total)")

if __name__ == "__main__":
    verify_full_strokes("/home/esfisher/dev/autoblow-panel/30-minute-slow-edging.funscript")
