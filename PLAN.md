# UI Redesign Plan: Stone/Amber Warm Theme

## Overview
Full visual overhaul from zinc/blue/purple to stone/amber warm aesthetic with custom typography.

## Strategy
Three layers, executed sequentially:

### Layer 1: Theme Foundation
1. **`index.css`** — Remap dark-mode CSS variables to stone/amber palette, add Google Fonts import, add warm background gradient, add range slider thumb styles
2. **`index.html`** — Preconnect to Google Fonts for performance

### Layer 2: Layout Shell
3. **`Layout.tsx`** — Add warm radial gradient background, update classes to stone
4. **`AppHeader.tsx`** — Amber gradient logo, Cormorant Garamond title, styled token input, animated connected indicator with ping, replace emoji plug with SVG
5. **`NavBar.tsx`** — Amber border accent on active tab, stone text colors
6. **`ConnectionStatusButton.tsx`** — Emerald/amber tones, stone card colors
7. **`CreationFooter.tsx`** — Stone colors, amber accents, update canvas hex colors

### Layer 3: All Components (pages, cards, controls, dialogs, loaders, players)
Systematic color replacement across every TSX file:
- `zinc-*` → `stone-*`
- `blue-600/700` → `amber-700/600` (primary actions)
- `blue-500/400/300` → `amber-500/400/300` (accents)
- `bg-green-600` → `bg-amber-700` (non-status buttons)
- `bg-emerald-600` → `bg-amber-700` (create pattern button)
- Canvas colors: `#8b5cf6` → `#c8956c`, keep `#ef4444` playhead
- Keep semantic green/yellow/red for status indicators (connected, sync, errors)

Specific files (all in src/components/):
- `pages/LibraryPage.tsx` — Stone cards, amber filter chips, warm badges
- `pages/PatternLibraryPage.tsx` — Amber "Create Pattern" button
- `pages/PlaylistPage.tsx` — Stone/amber styling
- `pages/VideoSyncPage.tsx` — Stone cards, amber accents
- `pages/DeviceLogPage.tsx` — Stone card, type badge colors aligned to reference
- `pages/ManualControlPage.tsx` — Stone card borders
- `pattern-library/PatternCard.tsx` — Stone card, canvas color `#c8956c`, intensity badge colors (emerald/amber/orange per reference)
- `pattern-library/PatternFilters.tsx` — Stone input, stone card
- `pattern-library/PatternGrid.tsx` — Amber clear-filters button
- `pattern-library/PatternDetailDialog.tsx` — Stone dialog, amber buttons
- `pattern-library/PatternEditorDialog.tsx` — Stone dialog, amber buttons
- `pattern-library/PatternDialogShell.tsx` — Stone backdrop/card
- `pattern-library/WaypointBuilderDialog.tsx` — Stone dialog, amber buttons
- `pattern-library/InsertPositionDialog.tsx` — Stone dialog, amber buttons
- `device-control/ManualControls.tsx` — Stone/amber pattern type buttons, amber start, orange stop
- `device-control/StatusIndicator.tsx` — Keep status colors (green/yellow/red)
- `device-control/SyncStatus.tsx` — Keep status colors
- `file-loader/FileDropzone.tsx` — Stone/amber dropzone styling
- `file-loader/VideoLoader.tsx` — Stone input, amber load button
- `file-loader/FunscriptLoader.tsx` — Stone styling
- `video-player/VideoPlayer.tsx` — Stone border
- `video-player/VideoControls.tsx` — Amber play button, stone colors
- `video-player/ProgressBar.tsx` — Amber accent
- `video-player/EmbedVideoPlayer.tsx` — Minimal changes
- `video-player/ManualSyncControls.tsx` — Stone/amber
- `playlist/PlaylistCard.tsx` — Stone card, amber edit button
- `playlist/PlaylistEditor.tsx` — Stone/amber styling
- `playlist/PlaylistControls.tsx` — Stone/amber
- `playlist/CreatePlaylistDialog.tsx` — Stone dialog, amber buttons
- `dialogs/ScriptNameDialog.tsx` — Stone dialog, amber submit button
- `timeline/TimelineCanvas.tsx` — Update hex colors if hardcoded
- `timeline/TimelineControls.tsx` — Stone/amber
- `timeline/TimelineAxis.tsx` — Stone colors
- `timeline/TimelineSeekBar.tsx` — Amber accent
- `timeline/TimelineEditorOverlay.tsx` — Stone/amber
- `timeline/PlayheadOverlay.tsx` — Keep red playhead
- `timeline/SmoothingOverlay.tsx` — Stone/amber
- `timeline/ValidationOverlay.tsx` — Keep semantic colors
- `timeline/Timeline.tsx` — Stone border
- `theme-provider.tsx` — No changes (just provides dark class)

## Font Configuration
- Display: `Cormorant Garamond` — page titles, app name, headings
- Body: `DM Sans` — all body text (set on body)
- Mono: `JetBrains Mono` — timestamps, values, token input

Applied via CSS custom properties: `--font-display`, `--font-body`, `--font-mono`

## Files Changed
~40 TSX files + index.css + index.html

## Verification
- `npx tsc --noEmit` — TypeScript clean
- `npx vitest run` — All tests pass
- Visual verification in browser
