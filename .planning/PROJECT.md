# Autoblow Panel

## What This Is

A privacy-first web interface for the Autoblow AI Ultra device that provides video-synced funscript playback, visual motion pattern editing, a persistent content library, playlist management, embedded video support, and real-time device testing. All content processing and storage is local — the only external dependency is Autoblow's cloud API (`latency.autoblowapi.com` + cluster endpoints) required by the SDK for device communication. Deployable via Docker with security hardening.

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
- ✓ Script smoother to remove noisy short movements from funscripts — v1.1
- ✓ Pattern editor for creating editable copies of presets with duration/motion controls — v1.1
- ✓ Pattern builder with step-based waypoint UI for custom pattern creation — v1.1
- ✓ Video/script library for persistent storage of played content — v1.1
- ✓ Playlist system with sequential playback and per-video funscript loading — v1.1
- ✓ Third-party video embedding with API-based funscript sync — v1.1
- ✓ Security hardening: localhost-only + Docker deployment — v1.1
- ✓ SQLite backend for persistent storage (replacing IndexedDB) — v1.1

### Active

(None — planning next milestone)

### Out of Scope

- Cloud storage or streaming — Privacy is core, content stays local (device control requires Autoblow cloud API)
- User accounts or authentication — Single-user, local tool
- Mobile app — Web-based only
- Multi-device support — Autoblow AI Ultra only
- Social/sharing features — Private tool for personal use
- Pattern marketplace or community features — Privacy-focused, no external connections
- Third-party video sync without embed API — Unreliable without player time access
- AI/ML-based script generation — Deterministic algorithms only
- Video storage in browser — Causes quota errors (videos are 100MB-5GB)
- Site-specific video scraping — Copyright/legal liability

## Context

**Current State (v1.1 shipped):**
- 16,723 LOC TypeScript/TSX across ~100+ files
- Tech stack: Vite + React 19 + TypeScript, Tailwind CSS, Express + SQLite (better-sqlite3), react-player, dnd-kit, helmet
- 6 pages: Library, Video Sync, Manual Control, Pattern Library, Playlists, Device Log
- Canvas-based timeline with editing, validation, smoothing, and pattern insertion
- 36+ motion patterns with animated previews, search/filter, custom editing, and waypoint builder
- Content library with SQLite persistence, playlist management, embedded video support
- Docker deployment with nginx reverse proxy and security headers
- AES-GCM encrypted device token storage

**Technical Environment:**
- Target device: Autoblow AI Ultra
- SDK: @xsense/autoblow-sdk (https://developers.autoblow.com/guides/autoblow-js-sdk/)
  - Calls `latency.autoblowapi.com` for device discovery and cluster assignment
  - All device commands (move, sync-script, etc.) routed through assigned cluster endpoint
- Backend: Express on port 3001, Vite on port 5173
- Database: SQLite with WAL mode via better-sqlite3

## Constraints

- **Privacy**: All local processing, no uploads, no tracking, no analytics. The only external network call is to Autoblow's cloud API (via `@xsense/autoblow-sdk`) for device discovery and command relay
- **Tech Stack**: Web-based (browser), must use autoblow-js-sdk for device communication
- **UI/UX**: Dark/modern theme, visual timeline editor with graph-based motion display, simple and intuitive controls
- **File Format**: Must support standard funscript format (JSON with actions array)
- **Device**: Autoblow AI Ultra only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Privacy-first local architecture | User's core requirement - no content uploads, no tracking; device control requires Autoblow cloud API | ✓ Good |
| Visual timeline editor | Inspired by funscript.io - intuitive way to see and edit motion patterns over time | ✓ Good |
| Web-based interface | Cross-platform, no installation, works on any device with browser | ✓ Good |
| Canvas API for timeline rendering | 10-100x faster than SVG for large funscript datasets | ✓ Good |
| Video element as master clock | Device follows video timing, single source of truth for sync | ✓ Good |
| Snapshot-based undo/redo | Simpler than command pattern, sufficient for expected edit volumes | ✓ Good |
| RAF drift detection every 2s | 200ms threshold keeps sync tight without excessive overhead | ✓ Good |
| Pure function pattern generators | No React dependencies, testable and composable | ✓ Good |
| Presentation components pattern | State lifted to App.tsx, pages are pure UI — clean separation | ✓ Good |
| AND-logic pattern filtering | All filters must match simultaneously — intuitive UX | ✓ Good |
| SQLite for persistent storage | IndexedDB unreliable across browser clears; SQLite more robust | ✓ Good |
| Layered architecture (repo-service-controller) | SOLID principles, testable, maintainable backend | ✓ Good |
| Vitest for testing | Vite-native, fast execution, TypeScript support | ✓ Good |
| Preview-without-mutation for smoothing | Prevents undo stack pollution during preview | ✓ Good |
| Multiplicative duration scaling | Preserves proportional timing relationships between actions | ✓ Good |
| ReactPlayer for embeds | Unified API across YouTube, Vimeo, and other platforms | ✓ Good |
| Manual sync for unsupported platforms | Graceful degradation when embed API unavailable | ✓ Good |
| Helmet CSP in production only | Prevents breaking Vite HMR in development | ✓ Good |
| AES-GCM token encryption | Protects device token at rest against generic XSS scrapers | ✓ Good |
| Docker multi-stage builds | Minimal image sizes, Alpine base for production | ✓ Good |

---
*Last updated: 2026-02-09 after v1.1 milestone*
