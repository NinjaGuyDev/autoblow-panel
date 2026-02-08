# Roadmap: Autoblow Panel

## Milestones

- ✅ **v1.0 MVP** - Phases 1-9 (shipped 2026-02-08)
- 🚧 **v1.1 Content Library & Advanced Editing** - Phases 10-16 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) - SHIPPED 2026-02-08</summary>

- [x] Phase 1: Core Infrastructure (2/2 plans) - completed 2026-02-06
- [x] Phase 2: Video Playback (2/2 plans) - completed 2026-02-06
- [x] Phase 3: Timeline Visualization (3/3 plans) - completed 2026-02-06
- [x] Phase 4: Device Communication (2/2 plans) - completed 2026-02-06
- [x] Phase 5: Synchronization Engine (2/2 plans) - completed 2026-02-06
- [x] Phase 6: UI Redesign (2/2 plans) - completed 2026-02-07
- [x] Phase 7: Timeline Editing (3/3 plans) - completed 2026-02-07
- [x] Phase 8: Script Validation & Polish (2/2 plans) - completed 2026-02-07
- [x] Phase 9: Pattern Library (2/2 plans) - completed 2026-02-07

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 Content Library & Advanced Editing (In Progress)

**Milestone Goal:** Transform the tool from a single-session player into a persistent content library with advanced pattern editing, playlist management, and third-party video support.

#### Phase 10: Backend Foundation + Content Library
**Goal**: Users can persist and browse their video/script library across sessions
**Depends on**: Nothing (first phase in milestone)
**Requirements**: INFRA-01, INFRA-02, LIB-01, LIB-02, LIB-03, LIB-04
**Success Criteria** (what must be TRUE):
  1. User can browse previously played videos and funscripts in persistent library
  2. Library persists across browser clears (SQLite backend running)
  3. User can search and filter library items by title or metadata
  4. User can quick-load a library item to resume playback
  5. IndexedDB data automatically migrates to SQLite on first backend connection
**Plans**: 3 plans

Plans:
- [x] 10-01-PLAN.md — Express backend with SQLite persistence and library CRUD API
- [x] 10-02-PLAN.md — IndexedDB migration and auto-save switch to backend
- [x] 10-03-PLAN.md — Library page UI with browse, search, filter, and quick-load

#### Phase 11: Script Smoothing
**Goal**: Users can clean noisy funscripts using automated smoothing algorithms
**Depends on**: Phase 10 (backend API for persistence)
**Requirements**: SMOOTH-01, SMOOTH-02, SMOOTH-03, SMOOTH-04
**Success Criteria** (what must be TRUE):
  1. User can apply smoothing to remove short movements, replacing with gradual motions
  2. User can adjust smoothing intensity via slider before applying
  3. User can preview before/after comparison on timeline before committing
  4. User can apply smoothing to selected region or entire script
  5. Smoothed scripts integrate with undo/redo system
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Three-pass smoothing algorithm engine (TDD)
- [x] 11-02-PLAN.md — Smoothing UI: hook, preview overlay, and timeline integration

#### Phase 12: Pattern Editing
**Goal**: Users can create editable copies of presets and adjust duration/intensity
**Depends on**: Phase 10 (backend for custom pattern storage)
**Requirements**: PATEDIT-01, PATEDIT-02, PATEDIT-03, PATEDIT-04, PATEDIT-05, PATEDIT-06
**Success Criteria** (what must be TRUE):
  1. User can create editable copy of any preset pattern (originals unchanged)
  2. User can reposition individual action points on copied patterns
  3. User can adjust pattern duration via text input (seconds)
  4. User can increase motion intensity (+10 distance per click, preserving start/end)
  5. User can demo pattern on device with looped playback and smoothed transitions
  6. Custom patterns appear first in pattern library listing
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md — Backend schema extension + pattern transformation functions
- [x] 12-02-PLAN.md — Pattern editor UI + custom pattern grid integration

#### Phase 13: Pattern Builder
**Goal**: Users can create custom patterns using step-based waypoint UI
**Depends on**: Phase 12 (pattern editor infrastructure)
**Requirements**: PATEDIT-07, PATEDIT-08
**Success Criteria** (what must be TRUE):
  1. User can create patterns via step-based waypoint UI (3-10 points)
  2. User can select interpolation type per segment (linear, easeIn, easeOut, easeInOut, step)
  3. User can load waypoint-built pattern onto device and loop for testing
  4. Built patterns save to library and appear in pattern listing
**Plans**: 2 plans

Plans:
- [x] 13-01-PLAN.md — Easing functions + waypoint-to-actions generator (TDD)
- [x] 13-02-PLAN.md — Waypoint builder UI + pattern library integration

#### Phase 14: Playlist Management
**Goal**: Users can create and play sequential playlists with per-video scripts
**Depends on**: Phase 10 (library must exist first)
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04
**Success Criteria** (what must be TRUE):
  1. User can create and save playlists of videos with associated funscripts
  2. Playlists play sequentially with automatic per-video funscript loading
  3. Playlists persist in library across sessions
  4. User can reorder, add, and remove items from a playlist
  5. Next script preloads during current playback to avoid gaps
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

#### Phase 15: Embedded Video Integration
**Goal**: Users can play third-party videos with funscript sync
**Depends on**: Phase 10 (library for storing embed links), Phase 14 (video playback system)
**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04
**Success Criteria** (what must be TRUE):
  1. User can paste third-party video URL (YouTube, Vimeo, adult sites) and play in interface
  2. Funscript sync works with embedded videos via platform API or manual sync fallback
  3. User can store embed links in library with associated funscripts
  4. Same playback controls (play/pause/seek) work for both local and embedded videos
  5. Platform detection switches between auto-sync (YouTube/Vimeo) and manual-sync (unsupported)
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

#### Phase 16: Security Hardening + Docker Deployment
**Goal**: Production-ready deployment with security hardening
**Depends on**: Phase 15 (all features implemented)
**Requirements**: INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Backend validates request origin (localhost/127.0.0.1/::1 only)
  2. App deployable via Docker with multi-stage build
  3. CSP headers configured for iframe embed security
  4. Token encryption at rest using Web Crypto API
  5. Production deployment runs on nginx with security headers
**Plans**: TBD

Plans:
- [ ] 16-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12 → 13 → 14 → 15 → 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Infrastructure | v1.0 | 2/2 | Complete | 2026-02-06 |
| 2. Video Playback | v1.0 | 2/2 | Complete | 2026-02-06 |
| 3. Timeline Visualization | v1.0 | 3/3 | Complete | 2026-02-06 |
| 4. Device Communication | v1.0 | 2/2 | Complete | 2026-02-06 |
| 5. Synchronization Engine | v1.0 | 2/2 | Complete | 2026-02-06 |
| 6. UI Redesign | v1.0 | 2/2 | Complete | 2026-02-07 |
| 7. Timeline Editing | v1.0 | 3/3 | Complete | 2026-02-07 |
| 8. Script Validation & Polish | v1.0 | 2/2 | Complete | 2026-02-07 |
| 9. Pattern Library | v1.0 | 2/2 | Complete | 2026-02-07 |
| 10. Backend Foundation + Content Library | v1.1 | 3/3 | Complete | 2026-02-08 |
| 11. Script Smoothing | v1.1 | 2/2 | Complete | 2026-02-08 |
| 12. Pattern Editing | v1.1 | 2/2 | Complete | 2026-02-08 |
| 13. Pattern Builder | v1.1 | 2/2 | Complete | 2026-02-08 |
| 14. Playlist Management | v1.1 | 0/TBD | Not started | - |
| 15. Embedded Video Integration | v1.1 | 0/TBD | Not started | - |
| 16. Security Hardening + Docker Deployment | v1.1 | 0/TBD | Not started | - |
