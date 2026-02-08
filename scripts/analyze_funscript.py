#!/usr/bin/env python3
"""Analyze the generated funscript to verify it meets specifications"""

import json

def analyze_funscript(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)

    actions = data['actions']

    print("=== Funscript Analysis ===\n")
    print(f"Total actions: {len(actions)}")
    print(f"Duration: {actions[-1]['at'] / 1000 / 60:.1f} minutes")
    print(f"Average speed: {data['metadata']['average_speed']} units/second\n")

    # Analyze segment durations
    durations = []
    for i in range(len(actions) - 1):
        duration = actions[i + 1]['at'] - actions[i]['at']
        durations.append(duration)

    avg_segment = sum(durations) / len(durations)
    min_segment = min(durations)
    max_segment = max(durations)

    print(f"Segment durations:")
    print(f"  Average: {avg_segment:.1f}ms")
    print(f"  Min: {min_segment}ms")
    print(f"  Max: {max_segment}ms")
    print(f"  Fluid motions (>40ms): {sum(1 for d in durations if d > 40)} / {len(durations)} ({sum(1 for d in durations if d > 40) / len(durations) * 100:.1f}%)\n")

    # Find pauses (same position held for >500ms)
    pauses = []
    for i in range(len(actions) - 1):
        if actions[i]['pos'] == actions[i + 1]['pos']:
            duration = actions[i + 1]['at'] - actions[i]['at']
            if duration > 500:
                pauses.append(duration)

    print(f"Pauses detected: {len(pauses)}")
    if pauses:
        print(f"  Average pause: {sum(pauses) / len(pauses):.1f}ms")
        print(f"  Longest pause: {max(pauses)}ms\n")

    # Find full strokes (visits to 0 or 100)
    extremes = [a for a in actions if a['pos'] in [0, 100]]
    print(f"Extreme positions (0 or 100): {len(extremes)}")
    print(f"  Position 0: {sum(1 for a in extremes if a['pos'] == 0)}")
    print(f"  Position 100: {sum(1 for a in extremes if a['pos'] == 100)}\n")

    # Analyze upward vs downward motion speeds
    up_durations = []
    down_durations = []

    for i in range(len(actions) - 1):
        distance = abs(actions[i + 1]['pos'] - actions[i]['pos'])
        duration = actions[i + 1]['at'] - actions[i]['at']

        if distance > 5 and duration > 0:  # Only significant movements
            speed = distance / (duration / 1000)  # units per second

            if actions[i + 1]['pos'] > actions[i]['pos']:
                up_durations.append(speed)
            elif actions[i + 1]['pos'] < actions[i]['pos']:
                down_durations.append(speed)

    if up_durations and down_durations:
        avg_up_speed = sum(up_durations) / len(up_durations)
        avg_down_speed = sum(down_durations) / len(down_durations)
        ratio = avg_up_speed / avg_down_speed

        print(f"Motion speed analysis:")
        print(f"  Average upward speed: {avg_up_speed:.2f} units/second")
        print(f"  Average downward speed: {avg_down_speed:.2f} units/second")
        print(f"  Speed ratio (up/down): {ratio:.2f}x")
        print(f"  Target: 1.25-1.40x (upward 25-40% faster)\n")

    # Position distribution
    pos_ranges = {
        "0-20": 0,
        "21-40": 0,
        "41-60": 0,
        "61-80": 0,
        "81-100": 0
    }

    for action in actions:
        pos = action['pos']
        if pos <= 20:
            pos_ranges["0-20"] += 1
        elif pos <= 40:
            pos_ranges["21-40"] += 1
        elif pos <= 60:
            pos_ranges["41-60"] += 1
        elif pos <= 80:
            pos_ranges["61-80"] += 1
        else:
            pos_ranges["81-100"] += 1

    print("Position distribution:")
    for range_name, count in pos_ranges.items():
        percentage = (count / len(actions)) * 100
        print(f"  {range_name}: {count} ({percentage:.1f}%)")

if __name__ == "__main__":
    analyze_funscript("/home/esfisher/dev/autoblow-panel/30-minute-slow-edging.funscript")
