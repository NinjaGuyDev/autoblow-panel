# Device Control API Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend API endpoints for remote device connection, looping pattern playback, and stop/status control — independent of the frontend's SDK connection.

**Architecture:** Single `DeviceService` holds an in-memory SDK `Ultra` instance. `PlaybackLoop` handles loop scheduling. `DeviceController` exposes HTTP endpoints. Reuses existing `LibraryService` for play-by-ID.

**Tech Stack:** Express.js, @xsense/autoblow-sdk, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-17-device-control-api-design.md`

---

## File Structure

```text
server/
├── services/playback-loop.ts           — CREATE: Loop scheduling (setTimeout-based restart)
├── services/device.service.ts          — CREATE: Connection lifecycle + playback orchestration
├── controllers/device.controller.ts    — CREATE: HTTP handlers for all device endpoints
├── routes/device.routes.ts             — CREATE: Route definitions
├── types/shared.ts                     — MODIFY: Add device API request/response types
├── index.ts                            — MODIFY: Wire up DI and mount routes
```

---

## Chunk 1: Shared Types + PlaybackLoop

### Task 1: Add Device API Types to shared.ts

**Files:**
- Modify: `server/types/shared.ts`

- [ ] **Step 1: Add device API types**

Append to the end of `server/types/shared.ts`:

```typescript
// === Device Control API Types ===

export interface DeviceConnectRequest {
  deviceKey: string;
}

export interface DeviceConnectResponse {
  status: 'connected';
  latencyMs: number;
}

export interface DeviceStatusResponse {
  connection: 'connected' | 'disconnected';
  playback: 'playing' | 'stopped';
  durationMs: number;
  looping: boolean;
  lastError: string | null;
}

export interface DevicePlayRequest {
  actions: Array<{ pos: number; at: number }>;
}

export interface DevicePlayResponse {
  status: 'playing';
  durationMs: number;
  name?: string;
}

export interface DeviceStopResponse {
  status: 'stopped';
}

export interface DeviceDisconnectResponse {
  status: 'disconnected';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.server.json`
Expected: No errors related to the new types.

- [ ] **Step 3: Commit**

```bash
git add server/types/shared.ts
git commit -m "feat: add device control API types to shared.ts"
```

---

### Task 2: Implement PlaybackLoop

**Files:**
- Create: `server/services/playback-loop.ts`
- Create: `server/__tests__/playback-loop.test.ts`

The PlaybackLoop is a server-side port of the frontend's `useDemoLoop` hook (`src/hooks/useDemoLoop.ts`). It uses setTimeout-based scheduling to check near the end of playback and restart from position 0.

Key reference: `src/lib/patternInsertion.ts` exports `createSmoothTransition(startPos, endPos, startTime)` which generates intermediate actions for seamless loop transitions. However, this is a frontend module with `@/` path aliases. We'll inline the smooth transition logic in PlaybackLoop since it's simple (linear ramp with a few intermediate points).

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/playback-loop.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackLoop } from '../services/playback-loop.js';

describe('PlaybackLoop', () => {
  let loop: PlaybackLoop;

  beforeEach(() => {
    vi.useFakeTimers();
    loop = new PlaybackLoop();
  });

  afterEach(() => {
    loop.destroy();
    vi.useRealTimers();
  });

  describe('getState', () => {
    it('returns stopped state initially', () => {
      const state = loop.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.durationMs).toBe(0);
    });
  });

  describe('prepareActions', () => {
    it('returns actions unchanged when first and last pos match', () => {
      const actions = [
        { pos: 0, at: 0 },
        { pos: 100, at: 500 },
        { pos: 0, at: 1000 },
      ];
      const result = loop.prepareActions(actions);
      expect(result).toEqual(actions);
    });

    it('appends smooth transition when first and last pos differ', () => {
      const actions = [
        { pos: 0, at: 0 },
        { pos: 100, at: 500 },
      ];
      const result = loop.prepareActions(actions);
      // Should have extra actions after the original ones
      expect(result.length).toBeGreaterThan(actions.length);
      // Last action should end near the first action's position
      const lastAction = result[result.length - 1];
      expect(lastAction.pos).toBe(actions[0].pos);
      // Transition actions should come after the last original action
      expect(result[actions.length].at).toBeGreaterThan(500);
    });

    it('throws on empty actions array', () => {
      expect(() => loop.prepareActions([])).toThrow();
    });
  });

  describe('destroy', () => {
    it('clears all timers and resets state', () => {
      loop.destroy();
      const state = loop.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.durationMs).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/playback-loop.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PlaybackLoop**

Create `server/services/playback-loop.ts`:

```typescript
import type { Ultra } from '@xsense/autoblow-sdk';

interface FunscriptAction {
  pos: number;
  at: number;
}

/** Check this far before the expected end to account for timing drift */
const CHECK_EARLY_MS = 500;
/** If the first check is too early, retry after this interval */
const RETRY_INTERVAL_MS = 250;
/** Duration of the smooth transition ramp in ms */
const TRANSITION_DURATION_MS = 300;
/** Number of intermediate points in smooth transition */
const TRANSITION_STEPS = 5;

/**
 * Server-side loop scheduler for continuous pattern playback.
 *
 * Port of the frontend's useDemoLoop hook. Uses setTimeout-based
 * scheduling to check near the end of playback and restart from
 * position 0 for seamless looping.
 */
export class PlaybackLoop {
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private currentActions: FunscriptAction[] | null = null;
  private scriptDurationMs: number = 0;
  private isPlaying: boolean = false;
  private cancelled: boolean = false;
  private lastError: string | null = null;

  getState(): { isPlaying: boolean; durationMs: number; lastError: string | null } {
    return {
      isPlaying: this.isPlaying,
      durationMs: this.scriptDurationMs,
      lastError: this.lastError,
    };
  }

  /**
   * Prepare actions for looping by appending a smooth transition
   * if the last position differs from the first.
   */
  prepareActions(actions: FunscriptAction[]): FunscriptAction[] {
    if (actions.length === 0) {
      throw new Error('Actions array must not be empty');
    }

    const firstPos = actions[0].pos;
    const lastAction = actions[actions.length - 1];

    if (firstPos === lastAction.pos) {
      return actions;
    }

    // Generate smooth linear ramp from lastPos back to firstPos
    const transitionActions: FunscriptAction[] = [];
    for (let i = 1; i <= TRANSITION_STEPS; i++) {
      const t = i / TRANSITION_STEPS;
      const pos = Math.round(lastAction.pos + (firstPos - lastAction.pos) * t);
      const at = lastAction.at + Math.round(TRANSITION_DURATION_MS * t);
      transitionActions.push({ pos, at });
    }

    return [...actions, ...transitionActions];
  }

  /**
   * Start looping playback on the device.
   * Uploads the funscript and begins the loop scheduling cycle.
   */
  async start(ultra: Ultra, actions: FunscriptAction[]): Promise<{ durationMs: number }> {
    // Stop any existing playback before uploading new script
    if (this.isPlaying) {
      await ultra.syncScriptStop();
    }
    this.clearTimer();
    this.cancelled = false;
    this.lastError = null;

    const prepared = this.prepareActions(actions);
    this.currentActions = prepared;
    this.scriptDurationMs = prepared[prepared.length - 1].at;

    // Create funscript object and upload
    const funscript = {
      version: '1.0',
      inverted: false,
      range: 100,
      actions: prepared,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ultra.syncScriptUploadFunscriptFile(funscript as any);
    await ultra.syncScriptStart(0);

    this.isPlaying = true;
    this.scheduleCheck(ultra, Date.now());

    return { durationMs: this.scriptDurationMs };
  }

  /**
   * Stop playback and clear all timers.
   */
  async stop(ultra: Ultra): Promise<void> {
    this.cancelled = true;
    this.clearTimer();

    if (this.isPlaying) {
      await ultra.syncScriptStop();
    }

    this.isPlaying = false;
    this.currentActions = null;
    this.scriptDurationMs = 0;
  }

  /**
   * Clean up all timers without device communication.
   * Use when disconnecting or shutting down.
   */
  destroy(): void {
    this.cancelled = true;
    this.clearTimer();
    this.isPlaying = false;
    this.currentActions = null;
    this.scriptDurationMs = 0;
    this.lastError = null;
  }

  private clearTimer(): void {
    if (this.loopTimer !== null) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private scheduleCheck(ultra: Ultra, cycleStart: number): void {
    if (this.cancelled) return;
    const elapsed = Date.now() - cycleStart;
    const waitMs = Math.max(0, this.scriptDurationMs - CHECK_EARLY_MS - elapsed);
    this.loopTimer = setTimeout(() => this.checkAndRestart(ultra, cycleStart), waitMs);
  }

  private async checkAndRestart(ultra: Ultra, cycleStart: number): Promise<void> {
    if (this.cancelled) return;

    try {
      const state = await ultra.getState();
      const isDevicePlaying = state.operationalMode === 'SYNC_SCRIPT_PLAYING';
      const nearEnd = state.syncScriptCurrentTime >= this.scriptDurationMs - CHECK_EARLY_MS;

      if (nearEnd || !isDevicePlaying) {
        // Restart from beginning
        await ultra.syncScriptStart(0);
        this.scheduleCheck(ultra, Date.now());
      } else {
        // Checked too early — retry shortly
        this.loopTimer = setTimeout(
          () => this.checkAndRestart(ultra, cycleStart),
          RETRY_INTERVAL_MS
        );
      }
    } catch (err) {
      // Device communication error — stop the loop, surface via getState().lastError
      this.isPlaying = false;
      this.lastError = err instanceof Error ? err.message : 'Device communication error during playback loop';
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/playback-loop.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/playback-loop.ts server/__tests__/playback-loop.test.ts
git commit -m "feat: add PlaybackLoop for server-side looping pattern playback"
```

---

## Chunk 2: DeviceService + Controller + Routes + Wiring

### Task 3: Implement DeviceService

**Files:**
- Create: `server/services/device.service.ts`

The DeviceService holds the SDK `Ultra` instance as a singleton, manages connection/disconnect lifecycle with a 30-minute inactivity timeout, and delegates playback to PlaybackLoop. It depends on `LibraryService` for the play-by-ID feature.

Key SDK reference — the frontend uses these calls (see `src/hooks/useDeviceConnection.ts` and `src/components/pattern-library/PatternDetailDialog.tsx`):
- `deviceInit(token)` → returns `{ deviceType, ultra }` — use the `ultra` instance
- `ultra.estimateLatency()` → returns latency in ms
- `ultra.syncScriptUploadFunscriptFile(funscript)` → upload script
- `ultra.syncScriptStart(timeMs)` → start playback at position
- `ultra.syncScriptStop()` → stop playback
- `ultra.getState()` → returns `{ operationalMode, syncScriptCurrentTime, ... }`

- [ ] **Step 1: Implement DeviceService**

Create `server/services/device.service.ts`:

```typescript
import { deviceInit } from '@xsense/autoblow-sdk';
import type { Ultra } from '@xsense/autoblow-sdk';
import { PlaybackLoop } from './playback-loop.js';
import type { LibraryService } from './library.service.js';
import type {
  DeviceConnectResponse,
  DeviceStatusResponse,
  DevicePlayResponse,
} from '../types/shared.js';

/** Auto-disconnect after 30 minutes of inactivity */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export class DeviceService {
  private ultra: Ultra | null = null;
  private connectionState: 'connected' | 'disconnected' = 'disconnected';
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: string | null = null;
  private playbackLoop: PlaybackLoop;

  constructor(private libraryService: LibraryService) {
    this.playbackLoop = new PlaybackLoop();
  }

  async connect(deviceKey: string): Promise<DeviceConnectResponse> {
    // Idempotent: if already connected, return current state
    if (this.ultra && this.connectionState === 'connected') {
      const latencyMs = await this.ultra.estimateLatency();
      this.resetInactivityTimer();
      return { status: 'connected', latencyMs };
    }

    const result = await deviceInit(deviceKey);

    if (result.deviceType !== 'autoblow-ultra' || !result.ultra) {
      throw new Error('Device connection failed: unsupported device type');
    }

    this.ultra = result.ultra;
    this.connectionState = 'connected';
    this.lastError = null;

    const latencyMs = await this.ultra.estimateLatency();
    this.resetInactivityTimer();

    return { status: 'connected', latencyMs };
  }

  async disconnect(): Promise<void> {
    // Idempotent: no-op if already disconnected
    if (this.connectionState === 'disconnected') return;

    // Stop any active playback
    if (this.ultra && this.playbackLoop.getState().isPlaying) {
      try {
        await this.playbackLoop.stop(this.ultra);
      } catch {
        // Best-effort stop during disconnect
      }
    }

    this.playbackLoop.destroy();
    this.ultra = null;
    this.connectionState = 'disconnected';
    this.lastError = null;
    this.clearInactivityTimer();
  }

  getStatus(): DeviceStatusResponse {
    const loopState = this.playbackLoop.getState();
    return {
      connection: this.connectionState,
      playback: loopState.isPlaying ? 'playing' : 'stopped',
      durationMs: loopState.durationMs,
      looping: loopState.isPlaying,
      lastError: this.lastError ?? loopState.lastError,
    };
  }

  async play(actions: Array<{ pos: number; at: number }>): Promise<DevicePlayResponse> {
    this.requireConnection();
    this.lastError = null;

    try {
      const result = await this.playbackLoop.start(this.ultra!, actions);
      this.resetInactivityTimer();
      return { status: 'playing', durationMs: result.durationMs };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Playback failed';
      throw err;
    }
  }

  async playById(id: number): Promise<DevicePlayResponse> {
    this.requireConnection();
    this.lastError = null;

    const item = this.libraryService.getItemById(id);
    const parsed = JSON.parse(item.funscriptData);
    // funscriptData may be { actions: [...], version } or raw array
    const actions: Array<{ pos: number; at: number }> = Array.isArray(parsed)
      ? parsed
      : parsed.actions;

    if (!actions || actions.length === 0) {
      throw new Error('Library item has no funscript actions');
    }

    try {
      const result = await this.playbackLoop.start(this.ultra!, actions);
      this.resetInactivityTimer();
      return {
        status: 'playing',
        durationMs: result.durationMs,
        name: item.funscriptName ?? item.videoName ?? `Item #${item.id}`,
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Playback failed';
      throw err;
    }
  }

  async stop(): Promise<void> {
    // Idempotent: no-op if not playing
    if (!this.ultra || !this.playbackLoop.getState().isPlaying) return;

    try {
      await this.playbackLoop.stop(this.ultra);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Stop failed';
      throw err;
    }
    this.resetInactivityTimer();
  }

  private requireConnection(): void {
    if (this.connectionState !== 'connected' || !this.ultra) {
      throw new Error('No device connected');
    }
  }

  private resetInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      console.log('[DeviceService] Inactivity timeout — auto-disconnecting');
      this.disconnect().catch((err) => {
        console.warn('[DeviceService] Auto-disconnect failed:', err);
      });
    }, INACTIVITY_TIMEOUT_MS);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.server.json`
Expected: No errors related to device.service.ts.

- [ ] **Step 3: Commit**

```bash
git add server/services/device.service.ts
git commit -m "feat: add DeviceService for backend device connection and playback"
```

---

### Task 4: Implement DeviceController

**Files:**
- Create: `server/controllers/device.controller.ts`

Follows the same pattern as `server/controllers/library.controller.ts`: arrow function methods, try/catch with `next(error)`, uses `parseIdParam` from validation middleware.

Input validation for the `play` endpoint: actions must be a non-empty array, each with `pos` (0-100) and `at` (>= 0), sorted ascending by `at`. Reject unsorted input with 400.

- [ ] **Step 1: Implement DeviceController**

Create `server/controllers/device.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { DeviceService } from '../services/device.service.js';
import type { DeviceConnectRequest, DevicePlayRequest } from '../types/shared.js';
import { parseIdParam } from '../middleware/validation.js';

export class DeviceController {
  constructor(private service: DeviceService) {}

  connect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceKey } = req.body as DeviceConnectRequest;
      if (!deviceKey || typeof deviceKey !== 'string') {
        res.status(400).json({ error: 'deviceKey is required and must be a string' });
        return;
      }

      const result = await this.service.connect(deviceKey);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Device connection failed')) {
        res.status(502).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  disconnect = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.disconnect();
      res.json({ status: 'disconnected' });
    } catch (error) {
      next(error);
    }
  };

  status = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(this.service.getStatus());
    } catch (error) {
      next(error);
    }
  };

  play = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { actions } = req.body as DevicePlayRequest;
      const validationError = validateActions(actions);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const result = await this.service.play(actions);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'No device connected') {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  playById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;

      const result = await this.service.playById(id);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'No device connected') {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  stop = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.stop();
      res.json({ status: 'stopped' });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate funscript actions array.
 * Returns an error message string, or null if valid.
 */
function validateActions(actions: unknown): string | null {
  if (!Array.isArray(actions) || actions.length === 0) {
    return 'actions must be a non-empty array';
  }

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (typeof action !== 'object' || action === null) {
      return `actions[${i}] must be an object with pos and at`;
    }
    if (typeof action.pos !== 'number' || action.pos < 0 || action.pos > 100) {
      return `actions[${i}].pos must be a number between 0 and 100`;
    }
    if (typeof action.at !== 'number' || action.at < 0) {
      return `actions[${i}].at must be a non-negative number`;
    }
    if (i > 0 && action.at < actions[i - 1].at) {
      return `actions must be sorted by 'at' ascending — actions[${i}].at (${action.at}) < actions[${i - 1}].at (${actions[i - 1].at})`;
    }
  }

  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.server.json`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/controllers/device.controller.ts
git commit -m "feat: add DeviceController with input validation"
```

---

### Task 5: Implement Device Routes and Wire Up DI

**Files:**
- Create: `server/routes/device.routes.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create device routes**

Create `server/routes/device.routes.ts`:

```typescript
import { Router } from 'express';
import type { DeviceController } from '../controllers/device.controller.js';

export function createDeviceRouter(controller: DeviceController): Router {
  const router = Router();

  // Connection lifecycle
  router.post('/connect', controller.connect);
  router.post('/disconnect', controller.disconnect);
  router.get('/status', controller.status);

  // Playback control
  router.post('/play', controller.play);
  router.post('/play/:id', controller.playById);
  router.post('/stop', controller.stop);

  return router;
}
```

- [ ] **Step 2: Wire up DI in server/index.ts**

Add imports near the top of `server/index.ts` (after the existing import block):

```typescript
import { DeviceService } from './services/device.service.js';
import { DeviceController } from './controllers/device.controller.js';
import { createDeviceRouter } from './routes/device.routes.js';
```

Add DI wiring after the existing analytics chain (around line 59, after `const analyticsRouter`):

```typescript
// Wire up device control dependency chain
const deviceService = new DeviceService(service);
const deviceController = new DeviceController(deviceService);
const deviceRouter = createDeviceRouter(deviceController);
```

Mount the route after the existing routes (around line 97, after `app.use('/api/media', mediaRouter)`):

```typescript
app.use('/api/device', deviceRouter);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.server.json`
Expected: No errors.

- [ ] **Step 4: Test the server starts**

Run: `cd /home/esfisher/dev/autoblow-panel && timeout 5 npx tsx server/index.ts 2>&1 || true`
Expected: Output includes "Server listening on port 3001" with no crash.

- [ ] **Step 5: Commit**

```bash
git add server/routes/device.routes.ts server/index.ts
git commit -m "feat: wire up device control API routes and DI"
```

---

### Task 6: Manual Integration Test

No automated integration test — the SDK requires a real device token. This task verifies the endpoints respond correctly when no device is connected.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (in a separate terminal or background)

- [ ] **Step 2: Test status endpoint (no connection)**

Run: `curl -s http://localhost:3001/api/device/status | python3 -m json.tool`
Expected:
```json
{
    "connection": "disconnected",
    "playback": "stopped",
    "durationMs": 0,
    "looping": false,
    "lastError": null
}
```

- [ ] **Step 3: Test play without connecting (409)**

Run: `curl -s -X POST http://localhost:3001/api/device/play -H 'Content-Type: application/json' -d '{"actions":[{"pos":0,"at":0},{"pos":100,"at":500}]}' | python3 -m json.tool`
Expected:
```json
{
    "error": "No device connected"
}
```
HTTP status: 409

- [ ] **Step 4: Test play with invalid actions (400)**

Run: `curl -s -X POST http://localhost:3001/api/device/play -H 'Content-Type: application/json' -d '{"actions":[]}' | python3 -m json.tool`
Expected:
```json
{
    "error": "actions must be a non-empty array"
}
```

- [ ] **Step 5: Test disconnect when not connected (200, idempotent)**

Run: `curl -s -X POST http://localhost:3001/api/device/disconnect | python3 -m json.tool`
Expected:
```json
{
    "status": "disconnected"
}
```

- [ ] **Step 6: Test stop when not playing (200, idempotent)**

Run: `curl -s -X POST http://localhost:3001/api/device/stop | python3 -m json.tool`
Expected:
```json
{
    "status": "stopped"
}
```

- [ ] **Step 7: Test connect with missing deviceKey (400)**

Run: `curl -s -X POST http://localhost:3001/api/device/connect -H 'Content-Type: application/json' -d '{}' | python3 -m json.tool`
Expected:
```json
{
    "error": "deviceKey is required and must be a string"
}
```

- [ ] **Step 8: Test validation — unsorted actions (400)**

Run: `curl -s -X POST http://localhost:3001/api/device/play -H 'Content-Type: application/json' -d '{"actions":[{"pos":0,"at":500},{"pos":100,"at":0}]}' | python3 -m json.tool`
Expected: 400 with error mentioning "sorted by 'at' ascending"

- [ ] **Step 9: Test validation — pos out of range (400)**

Run: `curl -s -X POST http://localhost:3001/api/device/play -H 'Content-Type: application/json' -d '{"actions":[{"pos":150,"at":0}]}' | python3 -m json.tool`
Expected: 400 with error mentioning "pos must be a number between 0 and 100"

- [ ] **Step 10: Commit (if any fixes were needed)**

Only commit if fixes were applied during testing. No commit needed if everything passed.
