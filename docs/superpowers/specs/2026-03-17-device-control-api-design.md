# Device Control API

Backend API for remote device connection, pattern playback with auto-looping, and library access.

## Decisions

- **Backend-driven device control** — Express server imports the Autoblow SDK directly. No browser required. The SDK uses `fetch` (available in Node 18+) and HTTP-based communication, so no browser-specific APIs are needed. `EventSource` (used by the frontend for button events) is not needed server-side since we only send commands, not listen for button presses.
- **No authentication** — Consistent with existing localhost-only restriction.
- **Persistent session** — Connect once, reuse across play/stop calls. 30-minute inactivity timeout.
- **Frontend unchanged** — Keeps its own direct SDK connection via DeviceContext. Two independent control paths.
- **Single-tenant** — One device connection at a time. Concurrent API callers share the same session; last-write-wins for conflicting commands.
- **Library access via existing endpoints** — Consumers use `/api/library` and `/api/library/custom-patterns` for browsing content. The device API only adds `play/:id` as a convenience that resolves a library item to funscript actions.

## API Surface

### Connection

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/device/connect` | Connect to device with key |
| POST | `/api/device/disconnect` | Disconnect from device |
| GET | `/api/device/status` | Connection + playback state (does NOT reset inactivity timer) |

### Playback

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/device/play` | Play raw funscript actions (looping) |
| POST | `/api/device/play/:id` | Play pattern/script by library ID (looping) |
| POST | `/api/device/stop` | Stop playback |

## Request/Response Shapes

### POST /api/device/connect

```json
// Request
{ "deviceKey": "string" }

// Response 200
{ "status": "connected", "latencyMs": 42 }
```

### POST /api/device/disconnect

```json
// Response 200
{ "status": "disconnected" }
```

### GET /api/device/status

```json
// Response 200
{
  "connection": "connected | disconnected",
  "playback": "playing | stopped",
  "durationMs": 5000,
  "looping": true,
  "lastError": null
}
```

- `durationMs` — Duration of a single loop cycle (not total elapsed time)
- `lastError` — Most recent SDK error message, or `null` if no error. Cleared on next successful play.

### POST /api/device/play

```json
// Request
{ "actions": [{ "pos": 0, "at": 0 }, { "pos": 100, "at": 500 }] }

// Response 200
{ "status": "playing", "durationMs": 500 }
```

### POST /api/device/play/:id

```json
// Response 200
{ "status": "playing", "durationMs": 5000, "name": "Pulse Wave" }
```

### POST /api/device/stop

```json
// Response 200
{ "status": "stopped" }
```

## Backend Architecture

### New Files

```
server/
├── controllers/device.controller.ts
├── services/device.service.ts
├── services/playback-loop.ts           — Loop scheduling logic (extracted)
├── routes/device.routes.ts
└── types/shared.ts                     (extended with device API types)
```

### DeviceService

Holds the SDK `Ultra` instance in memory as a singleton. Manages connection lifecycle and delegates playback to `PlaybackLoop`.

```typescript
class DeviceService {
  private ultra: Ultra | null = null;
  private connectionState: 'disconnected' | 'connected' = 'disconnected';
  private inactivityTimer: NodeJS.Timeout | null = null;
  private playbackLoop: PlaybackLoop;
  private lastError: string | null = null;

  constructor(private libraryService: LibraryService) {
    this.playbackLoop = new PlaybackLoop();
  }

  async connect(deviceKey: string): Promise<{ latencyMs: number }>
  async disconnect(): Promise<void>
  getStatus(): { connection, playback, durationMs, looping, lastError }

  async play(actions: FunscriptAction[]): Promise<{ durationMs: number }>
  async playById(id: number): Promise<{ durationMs: number, name: string }>
  async stop(): Promise<void>
}
```

### PlaybackLoop

Extracted loop scheduling logic. Responsible for:
- Uploading funscript to device and starting playback
- Scheduling near-end checks (~500ms before expected end)
- Calling `getState()` to verify near-end, then `syncScriptStart(0)` to restart
- Appending smooth transition actions (~300ms ramp) when last pos != first pos
- Stopping cleanly and clearing all timers

```typescript
class PlaybackLoop {
  private loopTimer: NodeJS.Timeout | null = null;
  private currentActions: FunscriptAction[] | null = null;
  private scriptDurationMs: number = 0;
  private isPlaying: boolean = false;

  async start(ultra: Ultra, actions: FunscriptAction[]): Promise<{ durationMs: number }>
  async stop(ultra: Ultra): Promise<void>
  getState(): { isPlaying: boolean, durationMs: number }
  destroy(): void  // Clear all timers
}
```

### DI Wiring

```typescript
// server/index.ts
const deviceService = new DeviceService(libraryService);
const deviceController = new DeviceController(deviceService);
const deviceRouter = createDeviceRouter(deviceController);
app.use('/api/device', deviceRouter);
```

Reuses existing `LibraryService` for `playById` (fetches item and extracts actions).

## Error Handling

| Scenario | Status | Response |
|----------|--------|----------|
| Play without connecting | 409 | `{ "error": "No device connected" }` |
| Connect when already connected | 200 | Idempotent, returns current info |
| Bad device key | 502 | `{ "error": "Device connection failed: ..." }` |
| Play/:id with invalid ID | 404 | `{ "error": "Library item not found" }` |
| Play while already playing | 200 | Stops current, starts new seamlessly |
| Stop when not playing | 200 | No-op, idempotent |
| Disconnect when not connected | 200 | No-op, idempotent |
| SDK error during loop | — | Loop stops, `isPlaying` set false, `lastError` populated. Surfaced via `GET /status`. |

## Input Validation

- `actions`: non-empty array, each with `pos` (0-100) and `at` (>= 0). Must be sorted by `at` ascending — reject with 400 if unsorted (likely client bug).
- `deviceKey`: non-empty string
- Invalid input returns 400 Bad Request

## Inactivity Timeout

30-minute timeout after last `connect`, `play`, or `stop` call. Auto-disconnects to free the device. `GET /status` does NOT reset the timer (prevents polling from keeping the connection alive indefinitely).
