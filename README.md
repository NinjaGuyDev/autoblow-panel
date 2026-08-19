# Autoblow Panel

> **Disclaimer:** This project is not affiliated with, endorsed by, or associated with Autoblow or its parent company in any way. This is an independent, community-built tool. Use at your own risk. The authors are not responsible for any damage to devices, data loss, or other issues arising from the use of this software.

A local-first application for controlling the Autoblow AI Ultra device. Create and edit funscript motion scripts, synchronize playback with local or embedded video, manage a content library, and build playlists — all running on your machine with no uploads, tracking, or analytics.

It ships two ways, from the same code: a **desktop app** you install, and a
**Docker container** you self-host and open in a browser. They behave
identically; pick whichever suits you.

## Installation

### Desktop app (Recommended)

Download the installer for your platform from the
[latest desktop release](https://github.com/NinjaGuyDev/autoblow-panel/releases?q=desktop&expanded=true):

| Platform | File | Notes |
|----------|------|-------|
| Linux | `.AppImage` | `chmod +x` it and run — no installation |
| Linux (Debian/Ubuntu) | `.deb` | `sudo apt install ./Autoblow-Panel-*.deb` |
| Windows | `.exe` (NSIS) | Unsigned, so SmartScreen shows a warning — choose *More info* → *Run anyway* |
| macOS | `.dmg` | Unsigned, so Gatekeeper blocks the first launch — right-click the app → *Open*, or `xattr -dr com.apple.quarantine "/Applications/Autoblow Panel.app"` |

Your library database and uploaded media are stored per user, outside the
application itself, so updating or reinstalling never touches them:

| Platform | Location |
|----------|----------|
| Linux | `~/.config/autoblow-panel/` |
| Windows | `%APPDATA%\autoblow-panel\` |
| macOS | `~/Library/Application Support/autoblow-panel/` |

The desktop app is self-contained: it starts its own backend on a free local
port and talks to nothing on the network except the Autoblow cloud API the
device SDK requires.

### Docker

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

Requires [Node.js](https://nodejs.org/) 24.x and npm — the version pinned in `.nvmrc` and enforced by the `engines` field in `package.json`.

```bash
git clone git@github.com:NinjaGuyDev/autoblow-panel.git
cd autoblow-panel
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend API on port 3001.

To run the desktop shell against that same dev server, with hot reload:

```bash
npm run dev:desktop
```

To build installers locally:

```bash
npx electron-builder install-app-deps   # rebuild better-sqlite3 for Electron's ABI
npm run dist                            # installers land in release/
npm run dist:dir                        # or an unpacked build, without installers
```

### Optional: Claude credentials for mod authoring

Generating a script mod from natural language calls Claude from the backend. It
reads the OAuth profile created by:

```bash
ant auth login
```

No API key or `.env` entry is needed, and every other feature — including
applying mods you have already saved — works without it. Without a login, the
"Create from text" dialog reports a 503 telling you to run the command above.

## Features

### Live Speed Control & Script Mods
- Numpad `1`-`9` speeds playback up 10%-90%, `Shift`+`1`-`9` slows it down, `0` restores original speed
- Saved "mods": reusable speed and pause programs applied to any script with one press
- Mods are authored from plain English via Claude, then run as pure local computation — no model call at playback time
- Speed and mod changes hot-swap the device script mid-playback

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

Desktop releases version separately from the web app:

| Version | Status | Highlights |
|---------|--------|------------|
| desktop-v1.0 | Shipped | Electron app, installers for Linux/Windows/macOS, per-user data directories |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| Backend | Express 5, SQLite (better-sqlite3) |
| Device SDK | @xsense/autoblow-sdk |
| Desktop | Electron 43, electron-builder |
| Deployment | Docker (nginx + Node.js single container), desktop installers |

## Usage

1. **Connect your device** -- Enter your device token in the header connection button
2. **Load media** -- Drag and drop a video file and/or `.funscript` file, or upload through the library
3. **Edit** -- Use the timeline editor to modify action points, or browse the pattern library to build a script
4. **Create** -- Click "New Script" to start from scratch, add patterns from the library
5. **Sync** -- Press play to synchronize video playback with your device
6. **Export** -- Save your work as a `.funscript` file or to your library

## Releasing

Two independent release lines, each driven by a tag:

| Tag | Workflow | Produces |
|-----|----------|----------|
| `v1.2.3` | `docker-publish.yml` | `ninjaguydev/autoblow-panel` image on Docker Hub |
| `desktop-v1.0.0` | `release-desktop.yml` | Installers attached to a GitHub release |

Both gate on `ci.yml` — typecheck, tests and build — before anything is
published. To cut a desktop release:

1. Add the version's section to [`CHANGELOG.md`](CHANGELOG.md).
2. Tag and push: `git tag desktop-v1.0.0 && git push origin desktop-v1.0.0`.

The workflow opens a draft release, builds all three platforms in parallel,
attaches their installers, fills the release notes from the changelog section
matching the tag, then publishes it.

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/NinjaGuyDev/autoblow-panel).

## License

Proprietary. All rights reserved.
