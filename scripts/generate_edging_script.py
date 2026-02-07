#!/usr/bin/env python3
"""
Generate a 30-minute slow edging funscript with specific characteristics:
- Fluid motions (40ms+ segments)
- Upward motions 25-40% faster than downward
- Random pauses (0-3 seconds)
- 5 full stroke loops (10-12 seconds each)
- Speed variations every 60 seconds
"""

import json
import random
import math

# Constants
DURATION_MS = 30 * 60 * 1000  # 30 minutes in milliseconds
BASE_SPEED = 1.0
SPEED_VARIATION_INTERVAL = 60 * 1000  # 60 seconds
UP_SPEED_MULTIPLIER = 1.50  # 50% faster upward (compensate for speed variations)

def calculate_duration(distance, going_up, speed_multiplier=1.0):
    """Calculate duration for a motion segment"""
    # Base duration: slower for edging (adjusted for better pacing)
    base_ms_per_unit = 150  # 150ms per position unit (slow but not too slow)
    duration = distance * base_ms_per_unit / speed_multiplier

    if going_up:
        duration /= UP_SPEED_MULTIPLIER

    return int(duration)

def generate_wave_motion(start_pos, end_pos, start_time, speed_mult=1.0):
    """Generate a smooth wave motion from start to end position"""
    going_up = end_pos > start_pos
    distance = abs(end_pos - start_pos)

    # Create wave with 5-7 intermediate points for fluid motion
    num_points = random.randint(5, 7)
    actions = []

    base_duration = calculate_duration(distance, going_up, speed_mult)

    for i in range(num_points + 1):
        progress = i / num_points

        # Add wave variation (±5-10 position units)
        wave_amplitude = random.randint(5, 10)
        wave_offset = wave_amplitude * math.sin(progress * math.pi * 2) if i not in [0, num_points] else 0

        # Calculate position with wave
        pos = start_pos + (end_pos - start_pos) * progress + wave_offset
        pos = max(0, min(100, int(pos)))

        time = start_time + int(base_duration * progress)
        actions.append({"at": time, "pos": pos})

    return actions, start_time + base_duration

def generate_gradual_motion(start_pos, end_pos, start_time, speed_mult=1.0):
    """Generate a gradual, smooth motion"""
    going_up = end_pos > start_pos
    distance = abs(end_pos - start_pos)

    # Create gradual motion with 8-10 intermediate points
    num_points = random.randint(8, 10)
    actions = []

    base_duration = calculate_duration(distance, going_up, speed_mult)

    for i in range(num_points + 1):
        progress = i / num_points

        # Ease in/out for smoothness
        eased_progress = (math.cos((1 - progress) * math.pi) + 1) / 2

        pos = start_pos + (end_pos - start_pos) * eased_progress
        pos = max(0, min(100, int(pos)))

        time = start_time + int(base_duration * progress)
        actions.append({"at": time, "pos": pos})

    return actions, start_time + base_duration

def generate_plateau_motion(start_pos, end_pos, start_time, speed_mult=1.0):
    """Generate motion with plateaus (holds)"""
    going_up = end_pos > start_pos
    distance = abs(end_pos - start_pos)

    actions = []
    base_duration = calculate_duration(distance, going_up, speed_mult)

    # Create 3 segments with plateaus
    num_segments = 3
    segment_distance = distance / num_segments

    current_pos = start_pos
    current_time = start_time

    for i in range(num_segments):
        target_pos = start_pos + (segment_distance * (i + 1) * (1 if going_up else -1))
        target_pos = int(target_pos)

        # Move to position
        segment_duration = base_duration // (num_segments * 2)
        actions.append({"at": current_time, "pos": int(current_pos)})
        current_time += segment_duration

        # Plateau (hold position)
        actions.append({"at": current_time, "pos": target_pos})
        current_time += segment_duration

        current_pos = target_pos

    # Final position
    actions.append({"at": current_time, "pos": end_pos})

    return actions, current_time

def add_pause(start_time):
    """Add a random pause (0-3 seconds)"""
    pause_duration = random.randint(0, 3000)
    return start_time + pause_duration

def generate_full_stroke(start_pos, start_time, speed_mult=1.0):
    """Generate a full stroke cycle (0-100-0 or 100-0-100)"""
    actions = []

    # Determine stroke direction - always start from current position
    if start_pos < 50:
        # Go up to 100, then down to 0
        positions = [start_pos, 100, 0]
    else:
        # Go down to 0, then up to 100
        positions = [start_pos, 0, 100]

    # Total duration should be 10-12 seconds
    total_duration = random.randint(10000, 12000)

    # First stroke (to extreme)
    first_distance = abs(positions[1] - positions[0])
    going_up_first = positions[1] > positions[0]
    first_duration = int((total_duration / 2) / (UP_SPEED_MULTIPLIER if going_up_first else 1.0))

    for i in range(8):
        progress = i / 7
        pos = int(positions[0] + (positions[1] - positions[0]) * progress)
        time = start_time + int(first_duration * progress)
        actions.append({"at": time, "pos": pos})

    # Second stroke (to other extreme)
    second_distance = abs(positions[2] - positions[1])
    going_up_second = positions[2] > positions[1]
    second_duration = int((total_duration / 2) / (UP_SPEED_MULTIPLIER if going_up_second else 1.0))

    for i in range(1, 8):
        progress = i / 7
        pos = int(positions[1] + (positions[2] - positions[1]) * progress)
        time = start_time + first_duration + int(second_duration * progress)
        actions.append({"at": time, "pos": pos})

    return actions, start_time + first_duration + second_duration, positions[2]

def generate_edging_script():
    """Generate the complete 30-minute edging script"""
    actions = []
    current_time = 0
    current_pos = 50  # Start in middle

    # Track when to insert full strokes (5 times throughout)
    full_stroke_times = sorted([random.randint(60000, DURATION_MS - 60000) for _ in range(5)])
    full_stroke_index = 0

    # Speed variation tracking
    next_speed_change = SPEED_VARIATION_INTERVAL
    speed_multiplier = 1.0
    in_speed_variation = False

    actions.append({"at": 0, "pos": current_pos})

    while current_time < DURATION_MS:
        # Check if we need to change speed
        if current_time >= next_speed_change:
            if in_speed_variation:
                # Return to normal speed
                speed_multiplier = 1.0
                in_speed_variation = False
                next_speed_change += SPEED_VARIATION_INTERVAL
            else:
                # Increase speed
                speed_multiplier = 1.0 + random.uniform(0.10, 0.30)
                in_speed_variation = True
                next_speed_change += SPEED_VARIATION_INTERVAL

        # Check if we should insert a full stroke
        if full_stroke_index < len(full_stroke_times) and current_time >= full_stroke_times[full_stroke_index]:
            stroke_actions, current_time, current_pos = generate_full_stroke(current_pos, current_time, speed_multiplier)
            actions.extend(stroke_actions)
            full_stroke_index += 1
            continue

        # Random pause (15% chance, avoiding during speed variations)
        if random.random() < 0.15 and not in_speed_variation:
            pause_time = add_pause(current_time)
            if pause_time > current_time:
                actions.append({"at": pause_time, "pos": current_pos})
                current_time = pause_time

        # Choose motion type
        motion_type = random.choice(['wave', 'gradual', 'plateau', 'gradual', 'wave'])

        # Determine next position (edging stays mostly in 25-85 range with variety)
        # Occasionally go to extremes for tease
        if random.random() < 0.15:  # 15% chance of extreme position
            target_pos = random.choice([15, 20, 85, 90])
        elif current_pos < 35:
            target_pos = random.randint(45, 85)
        elif current_pos > 75:
            target_pos = random.randint(25, 65)
        else:
            target_pos = random.randint(25, 85)

        # Generate motion
        if motion_type == 'wave':
            new_actions, current_time = generate_wave_motion(current_pos, target_pos, current_time, speed_multiplier)
        elif motion_type == 'gradual':
            new_actions, current_time = generate_gradual_motion(current_pos, target_pos, current_time, speed_multiplier)
        else:
            new_actions, current_time = generate_plateau_motion(current_pos, target_pos, current_time, speed_multiplier)

        actions.extend(new_actions)
        current_pos = target_pos

        # Safety check to prevent infinite loops
        if current_time > DURATION_MS + 60000:
            break

    # Ensure we end at a reasonable position
    if actions[-1]["at"] < DURATION_MS:
        actions.append({"at": DURATION_MS, "pos": 50})

    # Sort by time and remove duplicates
    actions = sorted(actions, key=lambda x: x["at"])
    unique_actions = []
    last_time = -1
    for action in actions:
        if action["at"] != last_time:
            unique_actions.append(action)
            last_time = action["at"]

    return unique_actions

def main():
    print("Generating 30-minute slow edging funscript...")

    actions = generate_edging_script()

    # Calculate average speed
    total_distance = sum(abs(actions[i+1]["pos"] - actions[i]["pos"])
                        for i in range(len(actions)-1))
    total_time_seconds = actions[-1]["at"] / 1000
    avg_speed = int(total_distance / total_time_seconds)

    funscript = {
        "version": "1.0",
        "inverted": False,
        "range": 100,
        "metadata": {
            "title": "30-Minute Slow Edging Session",
            "description": "Slow edging script with fluid motions, speed variations, and full stroke intensifiers",
            "duration": DURATION_MS,
            "average_speed": avg_speed,
            "creator": "Auto-generated",
            "tags": ["edging", "slow", "teasing", "30-minutes"]
        },
        "actions": actions
    }

    output_file = "/home/esfisher/dev/autoblow-panel/30-minute-slow-edging.funscript"
    with open(output_file, 'w') as f:
        json.dump(funscript, f, indent=2)

    print(f"✓ Generated funscript with {len(actions)} actions")
    print(f"✓ Duration: {actions[-1]['at'] / 1000 / 60:.1f} minutes")
    print(f"✓ Average speed: {avg_speed} units/second")
    print(f"✓ Saved to: {output_file}")

if __name__ == "__main__":
    main()
