# Autoblow Panel

A React-based control interface for the Autoblow AI Ultra device. Create, edit, and synchronize motion scripts with video playback.

## Features

### Video Synchronization
- Load video files and funscript motion scripts side by side
- Real-time video-to-device sync with automatic drift correction
- Latency estimation and offset adjustment
- Supports MP4, WebM, and OGG video formats

### Script Creation
- Create new motion scripts from scratch using the pattern library
- Name your scripts and export as `.funscript` files
- Supports both original and metadata funscript formats

### Pattern Library
- Browse 37+ pre-built motion patterns (waves, pulses, rhythmic, escalating, and more)
- Filter by intensity (low, medium, high) and style tags
- Animated canvas previews on hover
- Quick-add button for fast pattern insertion in creation mode
- Demo playback on connected device from pattern detail view
- Smart insertion with smooth transitions between patterns

### Timeline Editor
- Canvas-based editor for precise motion control at 60 FPS
- Select, draw, and drag action points
- Freehand drawing mode for custom motion curves
- Rectangle selection for multi-point editing
- Undo/redo with 50-level history
- Validation overlay highlighting safe, fast, and impossible motion segments
- Playhead tracking synchronized with video

### Manual Device Control
- Direct oscillation control with speed, min/max range sliders
- Sine wave, triangle wave, and random walk pattern generators
- Mutual exclusion with sync playback (prevents conflicting commands)

### Session Persistence
- Auto-saves work sessions to IndexedDB
- Recovers video and script state on page reload
- Device token persisted across sessions

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (included with Node.js)
- An Autoblow AI Ultra device and token (for device features)

### Setup

```bash
# Clone the repository
git clone git@github.com:NinjaGuyDev/autoblow-panel.git
cd autoblow-panel

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
# Type-check and build
npm run build

# Preview the production build
npm run preview
```

The build output is in the `dist/` directory and can be served by any static file host.

### Linting

```bash
npm run lint
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| Device SDK | @xsense/autoblow-sdk |
| Validation | Zod |
| Local Storage | Dexie (IndexedDB) |

## Usage

1. **Connect your device** -- Enter your device token in the header connection button
2. **Load media** -- Drag and drop a video file and/or `.funscript` file onto the app
3. **Edit** -- Use the timeline editor to modify action points, or browse the pattern library to build a script
4. **Create** -- Click "New Script" to start from scratch, name it, and add patterns from the library
5. **Sync** -- Press play to synchronize video playback with your device
6. **Export** -- Save your work as a `.funscript` file

## License

Proprietary. All rights reserved.
