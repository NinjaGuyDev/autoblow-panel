# Autoblow Panel

> **Disclaimer:** This project is not affiliated with, endorsed by, or associated with Autoblow or its parent company in any way. This is an independent, community-built tool. Use at your own risk. The authors are not responsible for any damage to devices, data loss, or other issues arising from the use of this software.

A local-first web application for controlling the Autoblow AI Ultra device. Create and edit funscript motion scripts, synchronize playback with local or embedded video, manage a content library, and build playlists — all running on your machine with no uploads, tracking, or analytics.

## Installation

### Docker (Recommended)

Run a single container from Docker Hub — no cloning required:

```bash
docker run -d \
  -p 8080:80 \
  -v ab-data:/app/data \
  -v ab-media:/app/media \
  --name autoblow-panel \
  ninjaguydev/autoblow-panel
```

Open `http://localhost:8080` in your browser.

The two volumes persist your library database and uploaded media across container restarts.

### npm (Development)

Requires [Node.js](https://nodejs.org/) v18+ and npm.

```bash
git clone git@github.com:NinjaGuyDev/autoblow-panel.git
cd autoblow-panel
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend API on port 3001.

## Features

### Video Synchronization
- Real-time video-to-device sync with automatic drift correction
- Latency estimation and offset adjustment
- Local video files (MP4, WebM, OGG, MKV, AVI) and embedded video (YouTube, Vimeo)
- Fullscreen video with keyboard shortcut

### Script Library
- Standalone script playback page with randomized script selection
- Save scripts to your persistent library
- Device pause button toggles video play/pause

### Content Library & Playlists
- SQLite-backed persistent library for videos, funscripts, and custom patterns
- Drag-and-drop playlist management with reordering
- Video upload with streaming playback and thumbnail generation
- Search and browse your collection

### Timeline Editor
- Canvas-based editor at 60 FPS with select, draw, and drag modes
- Freehand drawing for custom motion curves
- Rectangle selection for multi-point editing
- Undo/redo with 50-level history
- Validation overlay (safe, fast, impossible segments)
- Pattern insertion with smooth transitions

### Pattern Library
- 37+ pre-built motion patterns (waves, pulses, rhythmic, escalating, and more)
- Filter by intensity and style tags
- Animated canvas previews on hover
- Demo playback on connected device
- Custom pattern creation with waypoint builder

### Manual Device Control
- Direct oscillation control with speed, min/max range sliders
- Sine wave, triangle wave, and random walk generators

### Script Creation & Export
- Create scripts from scratch using the pattern library
- Export as `.funscript` files (original and metadata formats)

## Roadmap

| Version | Status | Highlights |
|---------|--------|------------|
| v1.0 | Shipped | Core playback, timeline editor, pattern library, manual control |
| v1.1 | Shipped | Express + SQLite backend, content library, playlists, embedded video, Docker deployment |
| v1.2 | Shipped | Script Library page, device pause, fullscreen, UI redesign |
| v1.3 | In Progress | Session analytics, climax tracking, script chapters, usage dashboard |
| v1.4 | Planned | Intensity profiles, remote control, script blending, theater mode |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| Backend | Express 5, SQLite (better-sqlite3) |
| Device SDK | @xsense/autoblow-sdk |
| Deployment | Docker (nginx + Node.js single container) |

## Usage

1. **Connect your device** -- Enter your device token in the header connection button
2. **Load media** -- Drag and drop a video file and/or `.funscript` file, or upload through the library
3. **Edit** -- Use the timeline editor to modify action points, or browse the pattern library to build a script
4. **Create** -- Click "New Script" to start from scratch, add patterns from the library
5. **Sync** -- Press play to synchronize video playback with your device
6. **Export** -- Save your work as a `.funscript` file or to your library

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/NinjaGuyDev/autoblow-panel).

## License

Proprietary. All rights reserved.
