# Pattern Randomizer

Multi-select patterns on the pattern library page, generate a randomized script of a desired length with smooth transitions, preview with a color-coded timeline and segment-triggered audio, and save to the library with audio mapping preserved.

## Dependencies

This feature requires two unmerged branches to be merged to main first:
- **feat/device-control-api** (PR #39) — provides `POST /api/device/toggle-pause`, pause button SSE subscription, `PlaybackLoop` with smooth transitions
- **feat/pattern-audio-attachments** (PR #40) — provides `audioFile` on `CustomPatternDefinition`, audio upload/stream endpoints, `mediaApi.streamUrl()`

## Decisions

- **Toggle mode on existing page** — "Randomize Mode" toggle on the Pattern Library page adds checkboxes to cards and a bottom toolbar with duration input + Generate button. No new page.
- **Read-only preview dialog** — generated script shown in a dialog with timeline, demo controls, save. No editing.
- **Weighted random** — patterns not yet used get higher weight, but repeats are allowed. Favors longer scripts: always adds the pattern that pushes over the desired duration.
- **Audio at segment boundaries** — each pattern's audio plays once as the playback cursor enters that segment.
- **Segment map preserved on save** — stored in `patternMetadata` so audio works when the saved script is played later.
- **Single playthrough** — no looping. Script plays once, stops at the end.

## Section 1: Selection Mode

### PatternLibraryPage Changes

- New state: `isRandomizeMode`, `selectedPatternIds: Set<string>`
- **Toggle button** in page toolbar — "Randomize Mode". Toggles `isRandomizeMode`.
- When active:
  - Checkboxes appear on each PatternCard (overlay in top-right corner)
  - Clicking a card toggles selection (highlighted border for selected)
  - Floating bottom toolbar appears with:
    - Selected count badge
    - Duration input (minutes, number field, default 5, min 1, max 60)
    - "Generate" button (disabled when < 2 patterns selected)
  - Normal card click behavior (open detail dialog) is suppressed — clicks toggle selection only
- Toggling mode off clears `selectedPatternIds`
- Both preset and custom patterns are selectable

## Section 2: Randomizer Algorithm

Pure function: `generateRandomizedScript(patterns, desiredDurationMs) => { actions, segments, totalDurationMs, audioTimeline? }`

The returned `RandomizedScript` may optionally include an `audioTimeline` — an array of `AudioTimelineCue` entries that trigger audio at specific timestamps. When present, playback uses `audioTimeline` cues instead of segment-level `audioFile` fields.

### Input
- `patterns: AnyPattern[]` — the selected patterns
- `desiredDurationMs: number` — target script length

### Algorithm
1. Initialize empty actions array, empty segments array, `currentTimeMs = 0`
2. Track usage count per pattern: `Map<string, number>`
3. While true:
   a. Compute weights for each pattern:
      - 0 uses → weight 3
      - 1 use → weight 1
      - 2+ uses → weight 0.5
   b. Weighted random pick
   c. Get pattern actions, time-shift to start at `currentTimeMs`
   d. If actions array is not empty, insert smooth transition (~300ms ramp from last pos to first pos of new pattern)
   e. Append shifted actions
   f. Record segment: `{ patternName, patternId, startMs: currentTimeMs, endMs: lastActionTime, audioFile? }`
   g. Update `currentTimeMs` to end of appended actions
   h. Increment usage count
   i. If `currentTimeMs >= desiredDurationMs` → stop (always add the pattern that pushes over, then stop)
4. Compute `totalDurationMs` from final action time
5. Return `{ actions, segments, totalDurationMs, audioTimeline? }`

### Output Types
```typescript
interface RandomizedSegment {
  patternName: string;
  patternId: string;
  startMs: number;
  endMs: number;
  audioFile?: string;
}

interface AudioTimelineCue {
  startMs: number;
  audioFile: string;
  durationSec: number;
}

interface RandomizedScript {
  actions: FunscriptAction[];
  segments: RandomizedSegment[];
  totalDurationMs: number;
  audioTimeline?: AudioTimelineCue[];
}
```

### Smooth Transitions
If last action pos differs from next pattern's first pos, insert a linear ramp over 300ms with 5 intermediate points:
```typescript
for (let i = 1; i <= 5; i++) {
  const t = i / 5;
  const pos = Math.round(lastPos + (nextFirstPos - lastPos) * t);
  const at = lastTime + Math.round(300 * t);
  transitionActions.push({ pos, at });
}
```
This is the same algorithm used in `PlaybackLoop.prepareActions()` (from the device-control-api branch).

## Section 3: Preview Dialog — RandomizerPreviewDialog

### Layout
- **Header** — "Randomized Script" | total duration (formatted as M:SS) | pattern count
- **Timeline canvas** — full-width, same height as existing timeline components
  - Each pattern segment rendered with a **distinct background color** from a cycling palette of 8 muted colors
  - **Pattern name** rendered in the upper region of the canvas (between 100% and 75% y-axis)
  - Funscript line drawn on top in warm amber (matching existing style)
  - **Playback cursor** — vertical red line showing current position during demo
- **Controls bar** below timeline:
  - Demo / Stop button
  - Pause / Resume button (or combined toggle)
  - Current time / total time display
  - Regenerate button (re-runs algorithm with same selections + duration)
- **Save section** — name input (pre-filled "Randomized - {YYYY-MM-DD}") + Save button
- **Close button** — top right

### Color Palette
8 muted, visually distinct background colors that don't compete with the amber funscript line:
```typescript
const SEGMENT_COLORS = [
  'rgba(59, 130, 246, 0.15)',   // blue
  'rgba(168, 85, 247, 0.15)',   // purple
  'rgba(236, 72, 153, 0.15)',   // pink
  'rgba(34, 197, 94, 0.15)',    // green
  'rgba(234, 179, 8, 0.15)',    // yellow
  'rgba(249, 115, 22, 0.15)',   // orange
  'rgba(20, 184, 166, 0.15)',   // teal
  'rgba(239, 68, 68, 0.15)',    // red
];
```

Each segment gets `SEGMENT_COLORS[segmentIndex % SEGMENT_COLORS.length]`.

### Pattern Name Rendering
- Rendered as white text with slight opacity (e.g., `rgba(255, 255, 255, 0.6)`)
- Positioned horizontally centered within the segment's x-range
- Positioned vertically between the 100% and 75% y-axis marks
- Font: 10px sans-serif. Only rendered if segment width > 40px AND the measured text width fits within the segment (with 8px padding). If it doesn't fit, skip rendering entirely — no ellipsis truncation, keeps canvas code simple.

## Section 4: Demo Playback

### Script Upload
- Upload the full assembled funscript to the device via SDK (`syncScriptUploadFunscriptFile` + `syncScriptStart(0)`)
- **No looping** — plays once through. When device reports playback complete or `syncScriptCurrentTime >= totalDurationMs`, stop automatically.

### Playback Position Tracking
- Self-scheduling `setTimeout` loop: awaits `ultra.getState()` to read `syncScriptCurrentTime`, updates the timeline cursor, then schedules the next tick ~200ms later. This prevents overlapping async calls (unlike `setInterval`).
- Checks current time against segment map to determine active segment
- First tick fires immediately on demo start (no initial 200ms delay) to handle cues at timestamp 0

### Audio Triggers
**Priority:** If `script.audioTimeline` exists and is non-empty, use timeline cues. Otherwise fall back to segment-level `audioFile`.

**Timeline mode:** Track which cues have been triggered (Set). On each poll tick, check if `currentTimeMs >= cue.startMs` for any untriggered cue. Stop prior audio and play the new cue.

**Segment mode:** Track `currentSegmentIndex` (initially -1). When segment changes, always stop prior audio. If the new segment has `audioFile`, play it. Silent segments cleanly stop any prior audio.

- On demo stop or dialog close: pause and clean up all audio

### Pause Support
- Physical button detection via `useDeviceButtons(ultra, nullRef, false, onTogglePause)` — pass a null video ref and `isEmbed: false`, the fallback video toggle path is a silent no-op since we only use the `onScriptPause` callback.
- Pause calls `ultra.syncScriptStop()` directly via the SDK (no backend proxy)
- Resume calls `ultra.syncScriptStart(currentTimeMsRef.current)` to restart from the last polled position
- When paused:
  - Position tracking continues but cursor freezes (device reports non-playing state, but hook tracks `isPaused` to distinguish from completion)
  - Audio stops
  - Timeline shows "PAUSED" indicator
- When resumed:
  - Audio does NOT resume mid-clip (it was a one-shot per segment)
  - Playback continues from where it was paused

### End of Script
- When `syncScriptCurrentTime >= totalDurationMs` or device reports not playing:
  - Stop position tracking interval
  - Clean up audio
  - Reset cursor to beginning
  - Update UI to show "Demo complete" state (Demo button re-enabled)

## Section 5: Save to Library

- **Save button** in the preview dialog
- Name input pre-filled with `"Randomized - {YYYY-MM-DD}"`
- Saves via `POST /api/library`:
  ```json
  {
    "videoName": null,
    "funscriptName": "{user-entered-name}.funscript",
    "funscriptData": "{\"version\":\"1.0\",\"inverted\":false,\"range\":100,\"actions\":[...]}",
    "duration": totalDurationMs / 1000,
    "isCustomPattern": 0,
    "patternMetadata": "{\"segments\": [{...}]}"
  }
  ```
- `patternMetadata` stores the segment map so audio mapping is preserved
- After save, show success feedback (e.g., brief "Saved!" toast or button state change)
- The saved script appears in the **Script Library** (regular library items, fetched via `libraryApi.getAll()`), NOT in the Pattern Library (custom patterns). This is intentional — randomized scripts are assembled scripts, not reusable patterns.

## New Files

```text
src/
├── lib/randomizer.ts                           — Pure randomizer algorithm
├── components/pattern-library/
│   ├── RandomizerToolbar.tsx                    — Bottom toolbar (selection count, duration, generate)
│   ├── RandomizerPreviewDialog.tsx              — Preview dialog (timeline, controls, save)
│   └── useRandomizerPlayback.ts                 — Hook for demo playback with audio triggers
├── types/randomizer.ts                          — RandomizedSegment, RandomizedScript types
```

## Modified Files

```text
src/
├── components/pattern-library/PatternCard.tsx   — Checkbox overlay in randomize mode
├── components/pages/PatternLibraryPage.tsx       — Randomize mode state, selection logic, toolbar
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| < 2 patterns selected | Generate button disabled |
| Duration < 1 or > 60 minutes | Input clamped to bounds |
| Device not connected for demo | Demo button disabled with tooltip |
| Audio file missing (404) on playback | Silently skip, pattern plays without audio |
| Save fails | Error message shown below save button |
| Device disconnects during demo | Stop demo, show error in controls bar |
