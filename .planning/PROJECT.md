# Autoblow Panel

## What This Is

A privacy-first web interface for the Autoblow AI Ultra device that provides video-synced funscript playback, visual motion pattern editing, and real-time device testing. Users can load local video files, sync them with funscripts, visually preview and edit motion patterns on a timeline, and test motions in real-time on their device - all without cloud services or uploads.

## Core Value

Smooth, privacy-preserving funscript playback synced with local video content.

## Requirements

### Validated

- ✓ Load local video files (MP4, WebM, etc.) into the interface — v1.0
- ✓ Auto-detect matching funscript files (same filename, .funscript extension) — v1.0
- ✓ Manually load/select funscript files — v1.0
- ✓ Play video with synchronized funscript execution on device — v1.0
- ✓ Visual timeline editor displaying motion patterns as a graph — v1.0
- ✓ Real-time device control via autoblow-js-sdk — v1.0
- ✓ Browse and preview motion pattern library (36 presets) — v1.0
- ✓ Load preset patterns into timeline — v1.0
- ✓ Draw motion curves directly on timeline — v1.0
- ✓ Edit individual action points (add, remove, adjust position/timing) — v1.0
- ✓ Export edited/created funscripts as .funscript files — v1.0
- ✓ Manual device controls for testing individual motions — v1.0
- ✓ Visual feedback showing current playback position on timeline — v1.0
- ✓ Pause/resume/seek controls affecting both video and device sync — v1.0

### Active

<!-- v1.1 scope -->
- [ ] Script smoother to remove noisy short movements from funscripts
- [ ] Pattern editor for creating editable copies of presets with duration/motion controls
- [ ] Pattern builder with step-based waypoint UI for custom pattern creation
- [ ] Video/script library for persistent storage of played content
- [ ] Playlist system with sequential playback and per-video funscript loading
- [ ] Third-party video embedding with API-based funscript sync
- [ ] Security hardening: localhost-only + Docker host access
- [ ] SQLite backend for persistent storage (replacing IndexedDB)

### Out of Scope

- Cloud storage or streaming — Privacy is core, everything stays local
- User accounts or authentication — Single-user, local tool
- Mobile app — Web-based only for v1
- Multi-device support — Autoblow AI Ultra only for v1
- Social/sharing features — Private tool for personal use
- Pattern marketplace or community features — Privacy-focused, no external connections
- Third-party video sync without embed API — Unreliable without player time access
- AI/ML-based script generation — Deterministic algorithms only for v1.1

## Current Milestone: v1.1 Content Library & Advanced Editing

**Goal:** Transform the tool from a single-session player into a persistent content library with advanced pattern editing, playlist management, and third-party video support.

**Target features:**
- Script smoother (algorithm from user-provided examples)
- Pattern editor (edit copies of presets, duration/motion controls, device demo with loop smoothing)
- Pattern builder (step-based waypoint UI, device loop testing)
- Video/script library (persistent storage, SQLite)
- Playlist (sequential playback, per-video scripts, saved to library)
- Third-party video embedding (Pornhub etc., API-only sync, embed links in library)
- Security (localhost-only, Docker host access)
- SQLite migration (replace IndexedDB)

## Context

**Current State (v1.0 shipped):**
- 8,566 LOC TypeScript/TSX across 92 files
- Tech stack: Vite + React + TypeScript, shadcn/ui, Tailwind CSS, Dexie (IndexedDB), autoblow-js-sdk
- 4 pages: Video Sync, Manual Control, Device Log, Pattern Library
- Canvas-based timeline with editing, validation, and pattern insertion
- 36 motion patterns with animated previews and search/filter

**Existing Assets:**
- 35+ pre-built motion patterns in motions/ directory
- Funscript format: JSON with `version`, `inverted`, `range`, and `actions` array containing `{pos, at}` pairs

**Technical Environment:**
- Target device: Autoblow AI Ultra
- SDK: autoblow-js-sdk (https://developers.autoblow.com/guides/autoblow-js-sdk/)

**User Intent:**
- Personal use for testing and enjoying content
- Privacy is paramount - no uploads, tracking, or external services
- Streamline workflow for testing existing patterns and creating custom synced content

## Constraints

- **Privacy**: All local processing, no cloud services, no uploads, no tracking, no analytics
- **Tech Stack**: Web-based (browser), must use autoblow-js-sdk for device communication
- **UI/UX**: Dark/modern theme, visual timeline editor with graph-based motion display, simple and intuitive controls
- **File Format**: Must support standard funscript format (JSON with actions array)
- **Device**: Autoblow AI Ultra only (other devices out of scope for v1)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Privacy-first local architecture | User's core requirement - no cloud, no uploads, complete privacy | ✓ Good |
| Visual timeline editor | Inspired by funscript.io - intuitive way to see and edit motion patterns over time | ✓ Good |
| Web-based interface | Cross-platform, no installation, works on any device with browser and autoblow-js-sdk support | ✓ Good |
| Canvas API for timeline rendering | 10-100x faster than SVG for large funscript datasets | ✓ Good |
| Video element as master clock | Device follows video timing, single source of truth for sync | ✓ Good |
| Snapshot-based undo/redo | Simpler than command pattern, sufficient for expected edit volumes | ✓ Good |
| RAF drift detection every 2s | 200ms threshold keeps sync tight without excessive overhead | ✓ Good |
| Pure function pattern generators | No React dependencies, testable and composable | ✓ Good |
| Presentation components pattern | State lifted to App.tsx, pages are pure UI — clean separation | ✓ Good |
| AND-logic pattern filtering | All filters must match simultaneously — intuitive UX | ✓ Good |

| SQLite for persistent storage | IndexedDB unreliable across browser clears; SQLite more robust for library/playlist data | — Pending |
| API-only third-party sync | Embed APIs vary; only sync where player exposes time API | — Pending |

---
*Last updated: 2026-02-08 after v1.1 milestone started*
