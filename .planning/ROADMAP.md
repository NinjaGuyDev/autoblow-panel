# Roadmap: Autoblow Panel

## Milestones

- ✅ **v1.0 MVP** - Phases 1-9 (shipped 2026-02-08)
- ✅ **v1.1 Content Library & Advanced Editing** - Phases 10-16 (shipped 2026-02-09)
- ✅ **v1.2 Script Library & UI Polish** - No GSD phases (shipped 2026-02-09)
- 🔄 **v1.3 Session Analytics & Script Intelligence** - Phases 17-22
- 📋 **v1.4 Advanced Tools & Content Management** - Phases TBD

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

<details>
<summary>✅ v1.1 Content Library & Advanced Editing (Phases 10-16) - SHIPPED 2026-02-09</summary>

- [x] Phase 10: Backend Foundation + Content Library (3/3 plans) - completed 2026-02-08
- [x] Phase 11: Script Smoothing (2/2 plans) - completed 2026-02-08
- [x] Phase 12: Pattern Editing (2/2 plans) - completed 2026-02-08
- [x] Phase 13: Pattern Builder (2/2 plans) - completed 2026-02-08
- [x] Phase 14: Playlist Management (4/4 plans) - completed 2026-02-08
- [x] Phase 15: Embedded Video Integration (2/2 plans) - completed 2026-02-09
- [x] Phase 16: Security Hardening + Docker Deployment (2/2 plans) - completed 2026-02-08

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.3 Session Analytics & Script Intelligence (Phases 17-22)

#### Phase 17: Session & Climax Backend
**Goal:** Backend foundation — sessions, climax_records, pause_events tables + full CRUD APIs
**Branch:** `gsd/phase-17-session-climax-backend`
**Requirements:** SESS-03, SESS-04, CLMX-02 (DB), CLMX-07, CLMX-08
**Dependencies:** None

**Scope:**
- `sessions` table: id, startedAt, endedAt, durationSeconds, scriptOrder (JSON), libraryItemId, context
- `climax_records` table: id, sessionId, timestamp, runwayData (JSON), libraryItemId, createdAt
- `pause_events` table: id, sessionId, timestamp, resumedAt, durationSeconds
- Repository → Service → Controller for each entity
- Routes mounted in server/index.ts with DI
- Shared types in server/types/shared.ts
- Stats/aggregation endpoints for dashboard consumption

#### Phase 18: Session Tracking UI
**Goal:** Opt-in overlay, useSessionTracking hook, integration with script playback
**Branch:** `gsd/phase-18-session-tracking-ui`
**Requirements:** SESS-01, SESS-02, SESS-05
**Dependencies:** Phase 17

**Scope:**
- SessionTrackingOverlay component (non-blocking toast, auto-dismiss 5s)
- useSessionTracking hook (opt-in state, session lifecycle, API calls)
- localStorage preference persistence
- Integration with useScriptPlayback / useUnifiedPlayback
- Demo/manual playback exclusion logic

#### Phase 19: Climax Tracker
**Goal:** Recording, timeline overlay, flash overlay, Climax Log page
**Branch:** `gsd/phase-19-climax-tracker`
**Requirements:** CLMX-01, CLMX-02 (funscript), CLMX-03, CLMX-04, CLMX-05, CLMX-06
**Dependencies:** Phase 17, Phase 18

**Scope:**
- useClimaxTracker hook (device pause detection, climax recording, runway snapshot)
- ClimaxOverlay on timeline (red vertical lines at climax timestamps)
- ClimaxRecordOverlay on video (flash animation)
- Toolbar button for manual climax marking in timeline editor
- ClimaxLogPage with session history, manual entry, delete
- Dual-storage: funscript JSON climax_data.points + climax_records table
- useClimaxRecords hook for data fetching

#### Phase 20: Script Length Filter
**Goal:** Classification utility, colored badges, randomize pool filtering
**Branch:** `gsd/phase-20-script-length-filter`
**Requirements:** SLEN-01, SLEN-02, SLEN-03, SLEN-04
**Dependencies:** None (parallel with 18, 19, 21)

**Scope:**
- classifyScriptLength() utility: short (<40s), medium (40s-2min), long (>2min)
- ScriptLength type enum
- Colored badges on ScriptLibraryPage items
- Filter chips (short/medium/long toggles) when randomize active
- Default filter: short + medium included, long excluded
- Integration with pickNextId in useScriptPlayback
- Header count badge showing filtered pool size

#### Phase 21: Script Chapters
**Goal:** Chapter data model, chapter bar component, seek/loop
**Branch:** `gsd/phase-21-script-chapters`
**Requirements:** CHAP-01, CHAP-02, CHAP-03, CHAP-04, CHAP-05
**Dependencies:** None (parallel with 18, 19, 20)

**Scope:**
- ChapterData interface in funscript types (name, startAt, endAt, color)
- chapterUtils.ts: CRUD operations on funscript chapter extensions
- ChapterBar component above timeline (colored labeled sections)
- Click to seek, double-click to rename
- Chapter creation via action range selection in timeline editor
- Chapter loop during playback (repeat section)
- Strip chapters on funscript export (.passthrough() preserves internally)

#### Phase 22: Usage Dashboard & Analytics
**Goal:** Dashboard page, analytics reports, personal records
**Branch:** `gsd/phase-22-usage-dashboard-analytics`
**Requirements:** DASH-01 through DASH-05, ANLZ-01 through ANLZ-04
**Dependencies:** Phase 17, Phase 18, Phase 19

**Scope:**
- DashboardPage with tab layout (Usage / Analytics)
- Usage tab: total session time (week/month/all), most played scripts, usage heatmap, avg session length, time-of-day distribution
- Analytics tab: stamina trend, script trigger analysis, time patterns, personal records
- Stat cards + tables for all report UI (no charting library)
- Backend aggregation endpoints for efficient queries
- Achievement/milestone system with trophy cards and badge grid

## Progress

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
| 14. Playlist Management | v1.1 | 4/4 | Complete | 2026-02-08 |
| 15. Embedded Video Integration | v1.1 | 2/2 | Complete | 2026-02-09 |
| 16. Security Hardening + Docker Deployment | v1.1 | 2/2 | Complete | 2026-02-08 |
| 17. Session & Climax Backend | v1.3 | 0/? | Pending | — |
| 18. Session Tracking UI | v1.3 | 0/? | Pending | — |
| 19. Climax Tracker | v1.3 | 0/? | Pending | — |
| 20. Script Length Filter | v1.3 | 0/? | Pending | — |
| 21. Script Chapters | v1.3 | 0/? | Pending | — |
| 22. Usage Dashboard & Analytics | v1.3 | 0/? | Pending | — |

### v1.4 Advanced Tools & Content Management (Phases TBD)

> Phases and requirements will be defined when v1.3 is complete. Features listed here for planning visibility.

**14 features planned:**

| # | Feature | Complexity | Source |
|---|---------|-----------|--------|
| 1 | Intensity Profiles / Script Modifiers | Medium | 7-features-part1.md #1 |
| 2 | Script Speed/Intensity Preview Heatmap | Low | 7-features-part1.md #4 |
| 3 | Star Ratings & Session Quality Tracking | Low-Medium | star-ratings.md |
| 4 | Remote Control via QR Code | Medium-High | 7-features-part1.md #6 |
| 5 | Script Blending / Layering | Medium | 7-features-part1.md #7 |
| 6 | Theater Mode | Low | 7-features-part2.md #9 |
| 7 | Script Analytics / X-Ray View | Low-Medium | 7-features-part2.md #10 |
| 8 | Smart Playlist Generator | Medium | 7-features-part2.md #11 |
| 9 | Script Import from URL / Drag-Drop | Low | 7-features-part2.md #12 |
| 10 | Video Bookmarks | Low | 7-features-part2.md #13 |
| 11 | Multi-Script Video Selector | Medium | multi-script-selector.md |
| 12 | Video + Script Trimming (FFmpeg) | Medium | video-script-trimming.md |
| 13 | Advanced Analytics Reports (Runway, Edging, Refractory) | Medium | climax-analytics-reports.md #3, #5, #6 |
| 14 | Session Quality Ratings (post-session prompts) | Medium | star-ratings.md |

## Dependency Graph

```
Phase 17 (Backend) ──┬──→ Phase 18 (Session UI) ──→ Phase 19 (Climax) ──→ Phase 22 (Dashboard)
                     │
Phase 20 (Length Filter) ─── independent
Phase 21 (Chapters) ──────── independent
```

**Execution strategy:**
- Wave 1: Phase 17 (must be first — backend foundation)
- Wave 2: Phases 18, 20, 21 (parallel — 18 needs 17, 20 and 21 are independent)
- Wave 3: Phase 19 (needs 17 + 18)
- Wave 4: Phase 22 (needs 17 + 18 + 19)
