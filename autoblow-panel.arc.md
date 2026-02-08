# Architecture Documentation: autoblow-panel

> Generated on: 2026-02-07
>
> This document provides comprehensive architecture documentation for the autoblow-panel repository.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [HTTP API Documentation](#http-api-documentation)
3. [Database Architecture](#database-architecture)
4. [Core Entities & Domain Models](#core-entities--domain-models)
5. [Authentication](#authentication)
6. [Authorization](#authorization)
7. [External Dependencies](#external-dependencies)
8. [Service Dependencies](#service-dependencies)
9. [Event Architecture](#event-architecture)
10. [Deployment & CI/CD](#deployment--cicd)
11. [Monitoring & Observability](#monitoring--observability)
12. [Feature Flags](#feature-flags)
13. [ML/AI Services](#mlai-services)
14. [Data Privacy & Compliance](#data-privacy--compliance)
15. [Security Assessment](#security-assessment)
16. [LLM Security Assessment](#llm-security-assessment)

---

## Project Overview

### Project Purpose

**Autoblow-Panel** is a React-based frontend control interface for the Autoblow AI Ultra intimate device. It provides:

- **Video Synchronization**: Sync video playback with device motion patterns (funscripts)
- **Pattern Library**: Browse and insert 37+ pre-built motion patterns into scripts
- **Script Creation**: Create custom motion scripts from scratch using pattern composition
- **Timeline Editing**: Visual timeline editor for precise motion control with undo/redo
- **Manual Control**: Direct device control with customizable motion parameters (oscillation, sine wave, triangle wave, random walk)
- **Device Logging**: Track device connection state, sync status, and errors
- **Funscript Support**: Import/export industry-standard .funscript files (both original and new metadata formats)

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.0 |
| Language | TypeScript | 5.9.3 |
| Build Tool | Vite | 7.2.4 |
| CSS | Tailwind CSS | 4.1.18 |
| Device SDK | @xsense/autoblow-sdk | 2.1.0 |
| Validation | Zod | 4.3.6 |
| Local DB | Dexie (IndexedDB) | 4.3.0 |
| File Upload | react-dropzone | 14.4.0 |
| Debouncing | use-debounce | 10.1.0 |
| CSS Utilities | clsx + tailwind-merge | 2.1.1 / 3.4.0 |

### Architecture Pattern

The application uses **React's composition pattern** with lifted state and custom hooks:

1. **Lifted State in App.tsx** - Root component manages cross-cutting concerns (video, funscript, device, undo/redo)
2. **Custom Hooks for Domain Logic** - 13 hooks encapsulating feature-specific logic
3. **Page Components as Presentational** - Tab-based pages receive props explicitly
4. **Canvas-Based Timeline Editor** - High-performance rendering for 1000+ action points

### Directory Structure

```
/src
├── App.tsx                    # Root component with lifted state
├── main.tsx                   # React entry point
├── index.css                  # Global Tailwind + CSS variables
├── /types                     # TypeScript type definitions (7 files)
├── /lib                       # Core business logic (12 files)
├── /hooks                     # React hooks (13 files)
├── /components
│   ├── /layout                # App shell, header, navbar, footer
│   ├── /pages                 # Tab content (4 pages)
│   ├── /file-loader           # Drag-and-drop file upload
│   ├── /video-player          # HTML5 video controls
│   ├── /timeline              # Canvas-based editor (8 components)
│   ├── /device-control        # Device connection and manual control
│   ├── /pattern-library       # Pattern browsing and insertion
│   └── /dialogs               # Modal dialogs
└── /assets
```

### Build & Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | TypeScript compilation + Vite bundling |
| `npm run lint` | ESLint with React plugins |
| `npm run preview` | Preview production build |

---

## HTTP API Documentation

### Status: No HTTP API Endpoints

This application is **entirely client-side** with **no HTTP fetch or REST API calls**. All device communication is handled through the **@xsense/autoblow-sdk** npm package.

### SDK Method Inventory

| Domain | Method | Purpose |
|--------|--------|---------|
| Connection | `deviceInit(token)` | Initialize device connection |
| Oscillation | `ultra.oscillateSet(speed, minY, maxY)` | Configure oscillation |
| Oscillation | `ultra.oscillateStart()` | Start oscillation |
| Oscillation | `ultra.oscillateStop()` | Stop oscillation |
| Sync | `ultra.syncScriptUploadFunscriptFile(funscript)` | Upload funscript |
| Sync | `ultra.syncScriptStart(timeMs)` | Start sync playback |
| Sync | `ultra.syncScriptStop()` | Stop sync playback |
| Sync | `ultra.syncScriptOffset(correctionMs)` | Apply drift correction |
| State | `ultra.getState()` | Get device playback position |
| Latency | `ultra.estimateLatency()` | Measure network latency |

### SDK Funscript Format

```typescript
{
  metadata: { id: number, version: 1 },
  actions: [{ at: number, pos: number }, ...]
}
```

### Error Types

- `DeviceNotConnectedError` - Device offline or not found
- `DeviceTimeoutError` - Connection timeout

---

## Database Architecture

### IndexedDB via Dexie

**Database:** `AutoblowPanelDB` (version 1)

**Table: `workSessions`**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | number (auto-increment) | Primary key (always 1) |
| `videoName` | string \| null | Current video filename |
| `funscriptName` | string \| null | Current funscript filename |
| `funscriptData` | string | JSON-stringified Funscript |
| `lastModified` | Date | Last update timestamp |

**Indexes:** `videoName`, `funscriptName`, `lastModified`

**Access Pattern:** Single record at `id=1` (overwrite on save)

**Files:**
- `src/lib/db.ts` - Database class definition
- `src/hooks/useAutoSave.ts` - Read/write operations via `useLiveQuery`

### localStorage

| Key | Value | Purpose |
|-----|-------|---------|
| `autoblow-device-token` | Device auth token | Persist connection across reloads |
| `autoblow-panel-theme` | `'dark'` \| `'light'` | UI theme preference |

---

## Core Entities & Domain Models

### Funscript Domain

| Entity | File | Properties |
|--------|------|------------|
| `FunscriptAction` | `types/funscript.ts` | `pos: 0-100`, `at: ms` |
| `FunscriptMetadata` | `types/funscript.ts` | title, description, performers, tags, etc. |
| `Funscript` | `types/funscript.ts` | actions[], optional metadata/version |
| `LoadedFunscript` | `types/funscript.ts` | file, name, data |
| `LoadedVideo` | `types/funscript.ts` | file, name, blobUrl, duration |
| `WorkSession` | `types/funscript.ts` | id, videoName, funscriptName, funscriptData, lastModified |

### Pattern Domain

| Entity | File | Properties |
|--------|------|------------|
| `Intensity` | `types/patterns.ts` | `'low'` \| `'medium'` \| `'high'` |
| `PatternDirection` | `types/patterns.ts` | `'up'` \| `'down'` \| `'neutral'` |
| `StyleTag` | `types/patterns.ts` | 17 values (wave, pulse, rhythmic, etc.) |
| `PatternDefinition` | `types/patterns.ts` | id, name, intensity, tags, durationMs, generator() |

### Device Domain

| Entity | File | Properties |
|--------|------|------------|
| `ConnectionState` | `types/device.ts` | `'disconnected'` \| `'connecting'` \| `'connected'` \| `'error'` |
| `PatternType` | `types/device.ts` | `'oscillation'` \| `'sine-wave'` \| `'triangle-wave'` \| `'random-walk'` |
| `OscillationParams` | `types/device.ts` | speed, minY, maxY |
| `ManualControlParams` | `types/device.ts` | extends OscillationParams + patternType, increment, variability |

### Sync Domain

| Entity | File | Properties |
|--------|------|------------|
| `SyncStatus` | `types/sync.ts` | `'idle'` \| `'uploading'` \| `'ready'` \| `'playing'` \| `'paused'` \| `'error'` |
| `SyncPlaybackState` | `types/sync.ts` | syncStatus, scriptUploaded, estimatedLatencyMs, driftMs, error |

### Timeline Domain

| Entity | File | Properties |
|--------|------|------------|
| `TimelineViewportState` | `types/timeline.ts` | viewStart, viewEnd, viewportDuration |
| `EditMode` | `types/timeline.ts` | `'select'` \| `'draw'` |
| `HitTestResult` | `types/timeline.ts` | index, action, distancePx |

### Validation Domain

| Entity | File | Properties |
|--------|------|------------|
| `SegmentClassification` | `types/validation.ts` | `'safe'` \| `'fast'` \| `'impossible'` |
| `ValidatedSegment` | `types/validation.ts` | startIndex, endIndex, classification, speed |
| `ValidationResult` | `types/validation.ts` | segments[], gaps[], summary |

### Zod Schemas

- `FunscriptActionSchema` - Validates pos (0-100), at (>=0)
- `OriginalFunscriptSchema` - version, inverted, range, actions[]
- `MetadataFunscriptSchema` - metadata, actions[]
- `FunscriptSchema` - Union accepting either format

---

## Authentication

### Device Token Authentication

The application implements simple token-based authentication for device connection:

- **Token Input:** User enters device token via UI (`AppHeader.tsx`, `DeviceConnection.tsx`)
- **Validation:** Token passed to `deviceInit(token)` from `@xsense/autoblow-sdk`
- **Persistence:** Saved to `localStorage` on successful connection
- **Lifecycle:** Token persists across page reloads (not cleared on disconnect)
- **Connection States:** `disconnected` → `connecting` → `connected` (or `error`)

### Error Handling

| Error Type | Message |
|-----------|---------|
| `DeviceNotConnectedError` | "Device not found or offline" |
| `DeviceTimeoutError` | "Connection timed out" |
| Generic `Error` | Error message text |

---

## Authorization

### Status: No Authorization System

There is **no role-based access control, permission checking, or authorization logic** in the codebase:

- No role definitions or permission matrix
- No protected routes or route guards
- No auth context or provider (only ThemeProvider)
- No multi-user support
- Once connected, all features are available

---

## External Dependencies

### Production Dependencies (8)

| Package | Version | Purpose | Critical |
|---------|---------|---------|----------|
| `@xsense/autoblow-sdk` | ^2.1.0 | Device communication SDK | Yes |
| `clsx` | ^2.1.1 | Conditional className builder | Yes |
| `dexie` | ^4.3.0 | IndexedDB wrapper | Yes |
| `dexie-react-hooks` | ^4.2.0 | Reactive database queries | Yes |
| `react` / `react-dom` | ^19.2.0 | UI framework | Yes |
| `react-dropzone` | ^14.4.0 | File drag-and-drop | Yes |
| `tailwind-merge` | ^3.4.0 | Tailwind class merging | Yes |
| `use-debounce` | ^10.1.0 | Debouncing hook | Yes |
| `zod` | ^4.3.6 | Schema validation | Yes |

### Development Dependencies (12)

| Package | Version | Purpose |
|---------|---------|---------|
| `@tailwindcss/vite` | ^4.1.18 | Vite Tailwind plugin |
| `@vitejs/plugin-react` | ^5.1.1 | React Fast Refresh |
| `eslint` | ^9.39.1 | Code linting |
| `eslint-plugin-react-hooks` | ^7.0.1 | React hooks rules |
| `eslint-plugin-react-refresh` | ^0.4.24 | HMR validation |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities |
| `typescript` | ~5.9.3 | TypeScript compiler |
| `typescript-eslint` | ^8.46.4 | TypeScript ESLint |
| `vite` | ^7.2.4 | Build tool |

All dependencies are actively used. No unused or unlisted dependencies detected.

---

## Service Dependencies

### Primary: @xsense/autoblow-sdk

The sole external service dependency. Provides:
- Device initialization and authentication
- Oscillation control (set, start, stop)
- Funscript upload and playback control
- Device state queries and drift detection
- Latency estimation

### Local Services

| Service | Technology | Purpose |
|---------|-----------|---------|
| IndexedDB | Dexie | Session persistence |
| localStorage | Browser API | Token and theme storage |
| Blob URLs | Browser API | In-memory video playback |
| File API | Browser API | File reading and export |

---

## Event Architecture

### DOM Event Listeners

**Video Element Events** (`useVideoPlayback.ts`, `useSyncPlayback.ts`):
- `play`, `pause`, `ended` - Playback state tracking
- `timeupdate` - Current time updates
- `loadedmetadata` - Video duration
- `seeked` - Device re-sync after seek

**Keyboard Events** (`VideoPlayer.tsx`, `Timeline.tsx`):
- Space/k - Toggle play/pause
- Arrow keys - Seek
- Delete - Remove selected points
- Ctrl+Z/Y - Undo/redo

### requestAnimationFrame Patterns

| Pattern | File | Interval | Purpose |
|---------|------|----------|---------|
| Drift detection | `useSyncPlayback.ts` | 2000ms | Video-device sync monitoring |
| Pattern preview | `PatternCard.tsx` | Per frame | Animated hover preview |
| Pattern detail | `PatternDetailDialog.tsx` | Per frame | Modal preview animation |

### ResizeObserver

- `Timeline.tsx` - Observes container width for canvas rendering

### Mutual Exclusion Logic

- Sync playback stops manual control when video plays
- Manual control pauses video when device starts
- Prevents conflicting commands to device

---

## Deployment & CI/CD

### Status: No Deployment Infrastructure

- **No CI/CD pipelines** (no `.github/workflows/`, no GitLab CI, etc.)
- **No Docker configuration**
- **No hosting provider configs** (no Vercel, Netlify, etc.)
- **No environment files** (no `.env`)
- **No infrastructure as code**

### Build Configuration

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite + React + Tailwind plugins, port 3000 |
| `tsconfig.json` | TypeScript config (strict mode, ES2022 target) |
| `tailwind.config.js` | Tailwind CSS (dark mode: class-based) |
| `.gitignore` | Ignores node_modules, dist, .env, .funscript files |

---

## Monitoring & Observability

### Status: Minimal/Local-Only Observability

**Console Logging:** Only 9 `console.error()` calls in `useSyncPlayback.ts` and 1 in `useVideoPlayback.ts`. No `console.log`, `console.warn`, or `console.info` usage.

**Device Log Hook** (`useDeviceLog.ts`):
- In-memory event log (max 500 entries)
- Types: `'sent'` | `'received'` | `'info'` | `'error'`
- Displayed in DeviceLogPage component
- Not persisted to disk

**No External Monitoring:**
- No Sentry/Bugsnag error tracking
- No Google Analytics or user analytics
- No APM or performance monitoring
- No structured logging framework
- No health checks

---

## Feature Flags

### Status: No Feature Flag Infrastructure

No feature flag systems, libraries, or patterns detected. All features are always enabled. No environment-based configuration or A/B testing infrastructure found.

---

## ML/AI Services

### Status: No ML/AI Integration

No machine learning or AI services integrated. All motion patterns are procedurally generated using mathematical functions. The validation system uses rule-based speed thresholds (not learned models):

- `safe`: < 250 units/second
- `fast`: 250-400 units/second
- `impossible`: > 400 units/second

---

## Data Privacy & Compliance

### Status: Privacy-by-Design

**Data Collection:** Zero telemetry, analytics, or external data transmission.

**Storage:**
- All data stored locally in browser (IndexedDB + localStorage)
- No cloud sync
- No server-side persistence
- User can clear all data via UI

**GDPR/CCPA:** Compliant by design - zero external data transmission, all data under user control.

---

## Security Assessment

### Overall Risk: LOW

| Category | Status | Notes |
|----------|--------|-------|
| XSS Vulnerabilities | PASS | No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval()` |
| Injection Attacks | PASS | All input validated with Zod schemas |
| Data Storage | PASS | No hardcoded secrets or credentials |
| CORS/CSP | N/A | No external HTTP requests |
| Dependencies | PASS | All legitimate, well-maintained packages |
| Insecure Communication | PASS | SDK handles device protocol |
| Input Validation | PASS | Comprehensive Zod + range clamping |
| Open Redirects | PASS | No user-controlled redirect targets |
| Data Exposure | PASS | Minimal logging, no PII |

### Notable Security Practices

- File download uses `rel="noopener noreferrer"` on anchor elements
- Blob URLs properly revoked after use to prevent memory leaks
- Device parameters range-clamped (0-100 bounds enforced)
- TypeScript strict mode prevents many runtime vulnerabilities
- React StrictMode enabled in development

### Recommendations (if deployed to network)

1. Add Content-Security-Policy headers
2. Enable HTTPS only
3. Consider token encryption at rest
4. Run `npm audit` regularly

---

## LLM Security Assessment

### Status: No LLM Integration

No LLM, AI service, or prompt construction patterns detected in the codebase. The application has zero AI/ML features - all functionality is deterministic and rule-based.

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Repository | autoblow-panel |
| Generated | 2026-02-07 |
| Sections | 16 |
| Generator | project-analyzer plugin |

---

*This document was automatically generated by the project-analyzer plugin for Claude Code.*
