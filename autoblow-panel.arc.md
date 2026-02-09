# Architecture Documentation: autoblow-panel

> Generated on: 2026-02-09
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

**Autoblow Panel** is a local-first web application for controlling the Autoblow AI Ultra device. It provides video-device synchronization, funscript editing, pattern creation, playlist management, and manual device control — all running on the user's machine with no uploads, tracking, or analytics. The only external dependency is Autoblow's cloud API (`latency.autoblowapi.com` + cluster endpoints), which the SDK requires for device discovery and command relay.

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend** | React + TypeScript | 19.2.0 / 5.9.3 |
| **Build Tool** | Vite | 7.2.4 |
| **Styling** | Tailwind CSS | 4.1.18 |
| **Backend** | Express.js | 5.2.1 |
| **Database** | SQLite (better-sqlite3) | 12.6.2 |
| **Device SDK** | @xsense/autoblow-sdk | 2.1.0 |
| **Validation** | Zod | 4.3.6 |
| **Local Storage** | Dexie (IndexedDB) | 4.3.0 |
| **Drag & Drop** | @dnd-kit/core + sortable | 6.3.1 / 10.0.0 |
| **Video Embed** | react-player | 3.4.0 |
| **Icons** | lucide-react | 0.563.0 |
| **Security** | Helmet | 8.1.0 |
| **File Upload** | Multer | 2.0.2 |

### Architecture Pattern

**Frontend:** Lifted State React Composition with domain-driven custom hooks (24 hooks), pure presentation components, and canvas-based timeline editing.

**Backend:** Layered architecture — Controllers → Services → Repositories → Database with constructor-based dependency injection throughout.

**Data Flow:**
```
User Action → Component → Hook (state + side effects) →
  → Lib (pure logic) → SDK or Database → Hook state update → Re-render
```

### Directory Structure

```
autoblow-panel/
├── src/                    # Frontend (React + TypeScript)
│   ├── App.tsx             # Root component, state orchestration
│   ├── main.tsx            # React DOM entry point
│   ├── components/         # 34+ UI components (layout, pages, timeline, etc.)
│   ├── hooks/              # 24 custom hooks (device, sync, editor, etc.)
│   ├── lib/                # 15+ pure utility modules (validation, patterns, etc.)
│   ├── types/              # 7 domain type definition files
│   └── contexts/           # React Context (DeviceContext)
├── server/                 # Backend (Express + TypeScript)
│   ├── index.ts            # Express app init, DI setup, middleware, routes
│   ├── controllers/        # 3 HTTP handlers (library, playlist, media)
│   ├── services/           # 2 business logic modules
│   ├── repositories/       # 2 data access modules
│   ├── routes/             # 4 route definitions + health
│   ├── middleware/          # 4 middleware (security, localhost, error, validation)
│   ├── db/                 # Connection + schema initialization
│   └── types/              # Shared frontend-backend types
├── docker/                 # Docker Compose + Dockerfiles + nginx.conf
├── data/                   # SQLite database (runtime, git-ignored)
├── media/                  # Video/media files (runtime, git-ignored)
└── public/                 # Static assets
```

### Code Metrics

| Layer | Files | LOC |
|-------|-------|-----|
| Frontend Components | 34+ TSX | ~5,000 |
| Frontend Hooks | 24 TS | ~4,000 |
| Frontend Utilities | 15+ TS | ~1,800 |
| Backend | ~20 TS | ~1,515 |
| **Total** | **~131 TS/TSX** | **~16,640** |

### Build & Development

```bash
npm run dev              # Run frontend (Vite:5173) + backend (Express:3001) concurrently
npm run build            # TypeScript compile + Vite bundle → dist/
docker-compose -f docker/docker-compose.yml up  # Production deployment
```

### Testing Setup

- **Framework:** Vitest 4.0.18 (configured, limited usage)
- **Test Files:** 3 existing tests in `src/lib/__tests__/` (easing, smoothing, waypointGenerator)
- **Coverage:** ~0% (only lib tests, no component/hook tests)

### Version Status

v1.1 shipped (phases 1-16 complete). Production-ready with Docker deployment support.

---

## HTTP API Documentation

### API Overview

| Metric | Count |
|--------|-------|
| **Total HTTP Endpoints** | 20 |
| **Controllers** | 3 |
| **Services** | 2 |
| **Repositories** | 2 |
| **Middleware** | 4 |
| **External HTTP APIs** | 0 |

All endpoints are prefixed and served from Express on port 3001. Frontend communicates via a type-safe API client (`src/lib/apiClient.ts`).

### Library API (`/api/library`)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/library` | `LibraryController.getAll` | List all library items (excludes custom patterns) |
| GET | `/api/library/search?q=` | `LibraryController.search` | Search by video/funscript name (LIKE query) |
| GET | `/api/library/:id` | `LibraryController.getById` | Get single item by ID |
| GET | `/api/library/custom-patterns` | `LibraryController.getCustomPatterns` | List custom patterns only |
| GET | `/api/library/migration-status` | `LibraryController.getMigrationStatus` | Check IndexedDB migration state |
| POST | `/api/library` | `LibraryController.create` | Create new library item |
| POST | `/api/library/migrate` | `LibraryController.migrate` | Bulk migrate from IndexedDB to SQLite |
| PUT | `/api/library` | `LibraryController.save` | Upsert library item by videoName |
| PATCH | `/api/library/:id` | `LibraryController.updateCustomPattern` | Update custom pattern data |
| DELETE | `/api/library/:id` | `LibraryController.delete` | Delete item + cascade media cleanup |

**Key Request/Response Types:**

```typescript
// Create/Save Request
interface CreateLibraryItemRequest {
  videoName: string | null;
  funscriptName: string | null;
  funscriptData: string;              // JSON stringified (required)
  duration: number | null;
  isCustomPattern?: number;           // 0=regular, 1=custom
  originalPatternId?: string | null;
  patternMetadata?: string | null;
}

// Response
interface LibraryItem {
  id: number;
  videoName: string | null;
  funscriptName: string | null;
  funscriptData: string;
  duration: number | null;
  lastModified: string;
  isCustomPattern: number;
  originalPatternId: string | null;
  patternMetadata: string | null;
}
```

### Playlist API (`/api/playlists`)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/playlists` | `PlaylistController.getAll` | List all playlists with item counts |
| GET | `/api/playlists/:id` | `PlaylistController.getById` | Get single playlist |
| GET | `/api/playlists/:id/items` | `PlaylistController.getItems` | Get playlist items with library data |
| POST | `/api/playlists` | `PlaylistController.create` | Create playlist |
| PATCH | `/api/playlists/:id` | `PlaylistController.update` | Update playlist name/description |
| DELETE | `/api/playlists/:id` | `PlaylistController.delete` | Delete playlist (cascade items) |
| POST | `/api/playlists/:id/items` | `PlaylistController.addItem` | Add library item to playlist |
| DELETE | `/api/playlists/:id/items/:itemId` | `PlaylistController.removeItem` | Remove item (compact positions) |
| PUT | `/api/playlists/:id/items/reorder` | `PlaylistController.reorderItems` | Reorder items (transactional) |

### Media API (`/api/media`)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/media` | `MediaController.list` | List video files in media directory |
| GET | `/api/media/check/:filename` | `MediaController.check` | Check file existence + size |
| GET | `/api/media/stream/:filename` | `MediaController.stream` | Stream video with HTTP Range support |
| POST | `/api/media/upload` | `MediaController.upload` | Upload video (multer, 10GB max) |
| GET | `/api/media/thumbnail/:filename` | `MediaController.getThumbnail` | Get video thumbnail |
| POST | `/api/media/thumbnail` | `MediaController.uploadThumbnail` | Upload thumbnail JPEG (5MB max) |

**File Restrictions:** `.mp4`, `.webm`, `.ogg`, `.mkv`, `.avi` | Thumbnails: JPEG only

### Health API

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/health` | Health route | Returns status, uptime, database check |

### Middleware Stack (applied in order)

1. `localhostOnly` — Restricts to `127.0.0.1` / `::1`
2. Security headers (Helmet, production only)
3. CORS — `origin: 'http://localhost:5173'`
4. JSON body parser (50MB limit)
5. Route handlers
6. Global error handler

### Device SDK Integration (Frontend Only)

The Autoblow device is controlled via `@xsense/autoblow-sdk` directly from the frontend — no backend proxy:

| Category | Method | Purpose |
|----------|--------|---------|
| Connection | `deviceInit(token)` | Initialize device |
| Oscillation | `ultra.oscillateSet(speed, minY, maxY)` | Configure pattern |
| Oscillation | `ultra.oscillateStart()` / `oscillateStop()` | Start/stop |
| Sync | `ultra.syncScriptUploadFunscriptFile(funscript)` | Upload script |
| Sync | `ultra.syncScriptStart(timeMs)` / `syncScriptStop()` | Playback control |
| Sync | `ultra.syncScriptOffset(correctionMs)` | Drift correction |
| State | `ultra.getState()` / `estimateLatency()` | Status + latency |

---

## Database Architecture

### Overview

| Property | Value |
|----------|-------|
| **Database** | SQLite 3 |
| **Driver** | better-sqlite3 12.6.2 (synchronous) |
| **Journal Mode** | WAL (Write-Ahead Logging) |
| **Busy Timeout** | 5000ms |
| **Foreign Keys** | Enabled |
| **Path** | `./data/autoblow.db` (configurable via `DB_PATH`) |

### Connection Setup

**File:** `server/db/connection.ts`

- Creates data directory if missing
- Single static connection (module-level export)
- Pragmas: WAL mode, 5s busy timeout, FK enforcement

### Tables

#### `library_items`

```sql
CREATE TABLE IF NOT EXISTS library_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  videoName TEXT,
  funscriptName TEXT,
  funscriptData TEXT NOT NULL,
  duration REAL,
  lastModified TEXT NOT NULL DEFAULT (datetime('now')),
  isCustomPattern INTEGER DEFAULT 0,
  originalPatternId TEXT,
  patternMetadata TEXT
);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | INTEGER | NO | Auto-increment PK |
| videoName | TEXT | YES | Video filename |
| funscriptName | TEXT | YES | Funscript filename |
| funscriptData | TEXT | NO | JSON-stringified funscript |
| duration | REAL | YES | Duration in seconds |
| lastModified | TEXT | NO | ISO timestamp |
| isCustomPattern | INTEGER | YES | 0=regular, 1=custom |
| originalPatternId | TEXT | YES | Source pattern ID |
| patternMetadata | TEXT | YES | JSON metadata |

**Indexes:** `videoName`, `funscriptName`, `lastModified DESC`, `isCustomPattern`

#### `playlists`

```sql
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  lastModified TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### `playlist_items`

```sql
CREATE TABLE IF NOT EXISTS playlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  library_item_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (library_item_id) REFERENCES library_items(id) ON DELETE CASCADE
);
```

**Indexes:** `(playlist_id, position)` composite, `library_item_id`

#### `migration_status`

```sql
CREATE TABLE IF NOT EXISTS migration_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  migrated INTEGER NOT NULL DEFAULT 0,
  migratedAt TEXT
);
```

Single-row table tracking IndexedDB→SQLite migration status.

### Relationships

```
playlists (1) ──→ playlist_items (M) ──→ library_items (1)
                   CASCADE DELETE           CASCADE DELETE
```

### Schema Migration Strategy

Idempotent initialization on startup — `CREATE TABLE IF NOT EXISTS` + `PRAGMA table_info` checks before `ALTER TABLE`. No versioned migration framework.

### Data Access Layer

```
Database (better-sqlite3)
  ↓
Repositories (parameterized queries, prepared statements)
  ├── LibraryRepository
  └── PlaylistRepository
  ↓
Services (business logic, validation)
  ├── LibraryService
  └── PlaylistService
  ↓
Controllers (HTTP handlers)
```

All queries use parameterized statements (`db.prepare().get/all/run`). Transactions via `db.transaction()` for batch operations (reorder, migration).

---

## Core Entities & Domain Models

### Shared API Types (`server/types/shared.ts`)

| Type | Purpose |
|------|---------|
| `LibraryItem` | Database row for video/funscript/pattern |
| `Playlist` | Database row for playlist with itemCount |
| `PlaylistItem` | Junction table row with library data |
| `CreateLibraryItemRequest` | POST/PUT request body |
| `CreatePlaylistRequest` | Playlist creation body |
| `UpdatePlaylistRequest` | Playlist update body |
| `MigrationRequest` | Bulk migration body |
| `ReorderPlaylistItemsRequest` | Reorder body (itemIds[]) |

### Funscript Domain (`src/types/funscript.ts`)

| Type | Purpose |
|------|---------|
| `FunscriptAction` | Single motion command: `{pos: 0-100, at: ms}` |
| `FunscriptMetadata` | Extended metadata (title, performers, tags, etc.) |
| `Funscript` | Complete funscript supporting original + new format |
| `LoadedVideo` | In-memory video file with Blob URL |
| `LoadedFunscript` | In-memory parsed funscript |
| `WorkSession` | Session persistence for IndexedDB/SQLite |

### Device Types (`src/types/device.ts`)

| Type | Purpose |
|------|---------|
| `ConnectionState` | `'disconnected' \| 'connecting' \| 'connected' \| 'error'` |
| `PatternType` | `'oscillation' \| 'sine-wave' \| 'triangle-wave' \| 'random-walk'` |
| `OscillationParams` | `{speed, minY, maxY}` all 0-100 |
| `ManualControlParams` | Full custom pattern params + variability |

### Pattern Types (`src/types/patterns.ts`)

| Type | Purpose |
|------|---------|
| `PatternDefinition` | Preset pattern with `generator()` function |
| `CustomPatternDefinition` | User-created with static `actions[]` + `isCustom: true` discriminator |
| `AnyPattern` | Union type for both |
| `StyleTag` | 17 motion style tags (wave, pulse, rhythmic, etc.) |
| `Intensity` | `'low' \| 'medium' \| 'high'` |
| `InterpolationType` | Easing functions for waypoint builder |

### Sync/Video Types (`src/types/sync.ts`, `video.ts`)

| Type | Purpose |
|------|---------|
| `SyncStatus` | `'idle' \| 'uploading' \| 'ready' \| 'playing' \| 'paused' \| 'error'` |
| `SyncPlaybackState` | Sync status + latency + drift + error |
| `PlatformType` | `'local' \| 'youtube' \| 'vimeo' \| 'supported-embed' \| 'unsupported-embed'` |

### Timeline/Editor Types (`src/types/timeline.ts`)

| Type | Purpose |
|------|---------|
| `EditMode` | `'select' \| 'draw'` |
| `TimelineViewportState` | Viewport start/end/duration for pan/zoom |
| `EditorState` | Full editor state (mode, selection, drag, draw) |
| `HitTestResult` | Canvas click target with distance |

### Validation Types (`src/types/validation.ts`)

| Type | Purpose |
|------|---------|
| `SegmentClassification` | `'safe' \| 'fast' \| 'impossible'` speed rating |
| `ValidatedSegment` | Speed analysis between consecutive actions |
| `ValidatedGap` | Time gap detection between actions |
| `ValidationResult` | Complete validation with summary stats |

### Zod Schemas (`src/lib/schemas.ts`)

```typescript
FunscriptSchema = union([
  OriginalFunscriptSchema,  // {version, inverted, range, actions}
  MetadataFunscriptSchema   // {metadata, actions}
]);
```

- `pos`: 0-100, `at`: >=0, `actions`: min 1 element
- `.passthrough()` allows additional properties

### Navigation (`src/types/navigation.ts`)

6 tabs: `library`, `playlists`, `video-sync`, `manual-control`, `device-log`, `pattern-library`

---

## Authentication

### Status: No User Authentication

This is a single-user, local-only application. There are no user accounts, login flows, or session management.

### Device Token Authentication

The only authentication is the device connection token for the Autoblow SDK:

- **Input:** User enters device token in connection dialog
- **Encryption:** AES-GCM with PBKDF2 key derivation (100K iterations, SHA-256)
- **Storage:** Encrypted in `localStorage` key `autoblow-device-token`
- **App Password:** Hardcoded `'autoblow-panel-v1'` (protects against generic XSS scrapers, not targeted attacks)
- **Backward Compat:** Detects and migrates legacy plaintext tokens
- **Implementation:** `src/lib/tokenEncryption.ts`

**Connection Flow:**
1. User enters token → `encryptToken()` → localStorage
2. On mount → `decryptToken()` → `deviceInit(token)` via SDK
3. Connection state managed in `DeviceContext`

---

## Authorization

### Status: No Authorization System

- No roles (user/admin/etc.)
- No permission checks on API endpoints
- No resource-level access control
- Single-user, local-only design assumption

### Access Control

The only access control is **IP-based localhost restriction**:

**File:** `server/middleware/localhost-only.ts`

```typescript
const ALLOWED_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
```

- Applied to all backend routes before CORS
- Returns `403 Forbidden` for non-localhost requests
- Logs security warnings: `[SECURITY] Access denied for IP: ${clientIp}`

### CORS Policy

```typescript
cors({ origin: 'http://localhost:5173', credentials: true })
```

Restricted to Vite dev server origin.

---

## External Dependencies

### Runtime Dependencies (18 packages)

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `@xsense/autoblow-sdk` | ^2.1.0 | Device communication | Device SDK |
| `react` / `react-dom` | ^19.2.0 | UI framework | Frontend |
| `express` | ^5.2.1 | HTTP server | Backend |
| `better-sqlite3` | ^12.6.2 | SQLite driver | Backend DB |
| `cors` | ^2.8.6 | CORS middleware | Backend |
| `helmet` | ^8.1.0 | Security headers | Backend |
| `multer` | ^2.0.2 | File uploads | Backend |
| `dexie` | ^4.3.0 | IndexedDB wrapper (migration) | Frontend |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop primitives | Frontend UI |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable lists | Frontend UI |
| `lucide-react` | ^0.563.0 | Icon library | Frontend UI |
| `react-dropzone` | ^14.4.0 | File drag-drop | Frontend |
| `react-player` | ^3.4.0 | Video embeds | Frontend |
| `tailwind-merge` | ^3.4.0 | Class merging | Frontend |
| `use-debounce` | ^10.1.0 | Debouncing hook | Frontend |
| `zod` | ^4.3.6 | Schema validation | Shared |
| `clsx` | ^2.1.1 | Class name utility | Frontend |

### Development Dependencies (12+ packages)

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ~5.9.3 | Type checking (strict mode) |
| `vite` | ^7.2.4 | Frontend build tool |
| `@vitejs/plugin-react` | ^5.1.1 | React Vite plugin |
| `@tailwindcss/vite` | ^4.1.18 | Tailwind CSS Vite plugin |
| `vitest` / `@vitest/ui` | ^4.0.18 | Unit testing |
| `tsx` | ^4.21.0 | TypeScript executor (backend dev) |
| `concurrently` | ^9.2.1 | Run multiple scripts |
| `eslint` | ^9.39.1 | Code linting |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities |
| Various `@types/*` | latest | Type definitions |

---

## Service Dependencies

### External Service: Autoblow Device SDK

**Package:** `@xsense/autoblow-sdk` v2.1.0 (frontend only)

This is the **only external service dependency**. The app communicates with the physical Autoblow AI Ultra device via the SDK's native protocol (not HTTP).

**Connection:** `deviceInit(token)` returns SDK instance
**Sync:** Upload funscript → start/stop/offset commands
**Manual:** Oscillation set/start/stop commands
**Monitoring:** `getState()` polling + `estimateLatency()`

### Internal Services

| Service | Port | Purpose |
|---------|------|---------|
| Vite Dev Server | 5173 | Frontend with HMR |
| Express Backend | 3001 | API + media streaming |
| SQLite | file-based | Data persistence |
| Filesystem | local | Video/thumbnail storage |

### Video Platform Embeds (iframe only, no API calls)

- YouTube (`youtube.com`, `youtube-nocookie.com`)
- Vimeo (`player.vimeo.com`)
- PornHub (`*.pornhub.com`)
- XVideos (`*.xvideos.com`)

Embedded via `<iframe>` with CSP `frame-src` restrictions. No direct API calls to these platforms.

---

## Event Architecture

### Frontend Event Systems

**React Context:** `DeviceContext` provides device connection state, logging, and SDK instance to all components.

**Video Element DOM Events** (handled in `useSyncPlayback`):
- `play` → Start device sync
- `pause` → Stop device sync
- `seeked` → Re-sync device timing
- `ended` → Stop device at video end

**RAF-Based Drift Detection:**
- `requestAnimationFrame` loop checks device state every 2 seconds during playback
- Drift threshold: 200ms (local video), 500ms (embed video)
- Maximum correction cap: 500ms
- Calls `ultra.syncScriptOffset(drift)` when threshold exceeded

**Debounced Events:**
- Oscillation parameter updates: 150ms debounce
- Custom pattern regeneration: 3000ms debounce

**Device Logging:**
- In-memory event log maintained in `useDeviceLog` (max 500 entries)
- Tracks connection states, errors, sync status
- Displayed in Device Log tab

### Backend Event Systems

**No real-time communication.** All backend communication is HTTP request/response:
- No WebSocket support
- No Server-Sent Events
- No message queues or pub/sub

---

## Deployment & CI/CD

### Docker Deployment

**Files:**
- `docker/Dockerfile` — Frontend: Node 20 Alpine (build) → nginx 1.25 Alpine (serve)
- `docker/Dockerfile.backend` — Backend: Node 20 Alpine (build) → Node 20 Alpine (runtime)
- `docker/docker-compose.yml` — Service orchestration
- `docker/nginx.conf` — Reverse proxy configuration

**Services:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| frontend | nginx:1.25-alpine | 80 | Static SPA + reverse proxy |
| backend | node:20-alpine | 3001 (localhost only) | API + media streaming |

**Volumes:**
- `sqlite-data:/app/data` — Persistent SQLite database
- `media-data:/app/media` — Persistent video/thumbnail files

**Network:** Bridge network `app-network` for inter-service communication

### Nginx Configuration

- Gzip compression (level 6) for text/CSS/JS/JSON
- Long-lived cache (1 year, immutable) for hashed static assets
- `/api` routes proxied to backend:3001
- SPA fallback: `try_files $uri $uri/ /index.html`
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP

### CI/CD

**Status:** No automated CI/CD pipelines configured. Manual deployment via Docker Compose.

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | development | Security headers applied when `production` |
| `PORT` | 3001 | Backend server port |
| `DB_PATH` | `./data/autoblow.db` | SQLite database path |
| `MEDIA_DIR` | `./media` | Video/thumbnail storage |

---

## Monitoring & Observability

### Health Check

**Endpoint:** `GET /health`

```json
{
  "status": "ok" | "error",
  "timestamp": "2026-02-09T...",
  "uptime": 123.45,
  "checks": { "database": "ok" | "error" }
}
```

- Returns `200` on success, `503` on database failure
- Docker health check: 30s interval, 10s timeout, 3 retries

### Logging

**Console logging only** — no structured logging framework (Winston/Pino), no log aggregation.

- Backend: Error logging in health check, error handler, services; security warnings for denied IPs
- Frontend: Error logging in hooks; device event log (500 entry max) displayed in UI

### Observability Gaps

- No structured logging
- No distributed tracing
- No APM/performance monitoring
- No error tracking (Sentry)
- No metrics collection (Prometheus)
- No request/response timing
- No database query profiling

---

## Feature Flags

### Status: No Feature Flag System

The only conditional logic is environment-based:

```typescript
// server/index.ts
if (process.env.NODE_ENV === 'production') {
  app.use(createSecurityMiddleware());
}
```

Security headers are only applied in production to avoid breaking Vite HMR in development.

No mechanism exists for gradual rollout, A/B testing, kill switches, or per-user feature enablement.

---

## ML/AI Services

### Status: No ML/AI Usage

The project explicitly excludes ML-based features (per `PROJECT.md`):

> "AI/ML-based script generation — Deterministic algorithms only"

All 36+ patterns are generated by **pure functions** (sine, cosine, pulse, random walk, etc.) in:
- `src/lib/patternDefinitions.ts` — 37 preset pattern definitions
- `src/lib/patternGenerators.ts` — Mathematical generator functions
- `src/lib/waypointGenerator.ts` — Bezier curve generation

No LLM calls, no model inference, no training data.

---

## Data Privacy & Compliance

### Privacy Architecture: Local-First

**Core Principle:** All data stays on the user's machine.

**Data Collected:**
| Data | Storage | Encryption |
|------|---------|------------|
| Video files | `./media/` filesystem | No (local only) |
| Funscript data | SQLite `funscriptData` column | No (local only) |
| Device token | localStorage (browser) | AES-GCM encrypted |
| Playlists | SQLite | No (local only) |
| Custom patterns | SQLite | No (local only) |
| Session state | IndexedDB (browser) | No (local only) |

**Data NOT Collected:**
- No cloud uploads (device commands routed through Autoblow cloud API by SDK — this is the only external dependency)
- No user accounts or PII
- No telemetry or analytics
- No cookies or tracking
- No third-party data sharing

### Data Retention

- No automatic deletion; user retains full control
- Delete endpoint cascades: database record + video file + thumbnail
- No archival or backup mechanism

### GDPR/CCPA Compliance

**Limited applicability** (single-user, local-only):
- Art. 17 (Right to Erasure): Delete via UI → cascades to all data
- Art. 20 (Portability): Manual export of `.funscript` files
- Art. 32 (Security): Encrypted tokens, parameterized SQL, localhost-only
- No "sale" of personal information (CCPA)

---

## Security Assessment

### OWASP Top 10 Assessment

| Vulnerability | Risk | Status |
|---|---|---|
| **A01: Broken Access Control** | Localhost-only limits attack surface | Mitigated |
| **A02: Cryptographic Failures** | Token encryption (AES-GCM + PBKDF2) | Mitigated |
| **A03: Injection** | Parameterized SQL, no eval | Mitigated |
| **A04: Insecure Design** | No authentication needed (local-only) | Design-appropriate |
| **A05: Security Misconfiguration** | CSP enforced in production | Partially addressed |
| **A06: Vulnerable Components** | No automated scanning | Gap |
| **A07: Authentication Failures** | Device token encrypted at rest | Design-appropriate |
| **A08: Software/Data Integrity** | No lockfile signing | Minor gap |
| **A09: Logging/Monitoring** | Console logging only | Limited |
| **A10: SSRF** | No outbound API calls | Not applicable |

### Security Strengths

1. **Localhost-Only Enforcement** — IP filtering blocks all non-localhost requests
2. **Parameterized Queries** — SQL injection prevention via better-sqlite3
3. **Token Encryption** — AES-GCM with PBKDF2 (100K iterations) at rest
4. **CSP Headers** — Restrictive Content-Security-Policy in production
5. **Helmet Security Headers** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy
6. **React Auto-Escaping** — No `dangerouslySetInnerHTML` usage found
7. **Directory Traversal Prevention** — `path.basename()` on all file parameters
8. **CORS Restriction** — Limited to `localhost:5173`
9. **File Extension Whitelist** — Video uploads restricted to known types

### Security Weaknesses

| Weakness | Severity | Notes |
|----------|----------|-------|
| No request body schema validation | Medium | Controllers use TypeScript type assertions, not runtime validation |
| No rate limiting | Low | DoS vector via uploads/searches (mitigated by localhost-only) |
| No HTTPS enforcement | Low | N/A for localhost; needed if network-exposed |
| Error information disclosure | Low | Error messages may leak implementation details |
| File upload without magic number check | Low | Extension check only, not MIME type verification |
| Hardcoded app password | Low | Token encryption password in source (acceptable for local-only) |
| No CSRF protection | Low | Mitigated by localhost-only + no cookies |
| No automated dependency scanning | Low | No Dependabot/Snyk integration |

### CSP Configuration

```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'     (Tailwind requirement)
frame-src youtube, vimeo, pornhub, xvideos
img-src 'self' data: https:
connect-src 'self'
```

---

## LLM Security Assessment

### Status: No LLM Usage Detected

The autoblow-panel application does **not** use any LLM, AI model, or generative AI services. Specifically:

- No LLM API calls (OpenAI, Anthropic, etc.)
- No prompt construction or injection vectors
- No AI-generated content
- No RAG (Retrieval Augmented Generation) patterns
- No embedding generation or vector search
- No fine-tuned models or model files

The project explicitly states "AI/ML-based script generation — Deterministic algorithms only" as a design constraint.

**Assessment:** Not applicable. No LLM security risks present.

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Repository | autoblow-panel |
| Generated | 2026-02-09 |
| Sections | 16 |
| Generator | project-analyzer plugin |

---

*This document was automatically generated by the project-analyzer plugin for Claude Code.*
