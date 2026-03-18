# Pattern Audio Attachments

Attach audio files to custom patterns that play through the browser speakers once when a pattern demo starts.

## Decisions

- **Extend existing media system** — reuse MediaController's upload/stream infrastructure. No new controller or directory.
- **Upload only** — no recording or TTS generation in the UI. Users upload `.mp3`, `.wav`, or `.ogg` files.
- **Play once** — audio plays once on demo start, does not loop with the pattern.
- **Editor-only UI** — upload and preview controls live in the pattern editor, not the detail dialog. Detail dialog just plays audio on demo start.
- **Stored in patternMetadata** — `audioFile` field added to the existing JSON blob. No schema migration needed.

## Backend Changes

### MediaController

- Whitelist audio extensions: `.mp3`, `.wav`, `.ogg`
- New endpoint: `POST /api/media/upload-audio` — multer with 5MB limit. Filename sanitized server-side: `audio-{Date.now()}-{path.basename(originalname).replace(/[^a-zA-Z0-9._-]/g, '')}`. Stored in existing `media/` directory.
- New endpoint: `DELETE /api/media/audio/:filename` — deletes an audio file. Must sanitize with `path.basename()` and verify resolved path is within `mediaDir` (matching existing `resolveMediaPath` pattern for path traversal protection).
- Update `mimeType()` to handle audio extensions: `.mp3` → `audio/mpeg`, `.wav` → `audio/wav`. For `.ogg`, use the `audio-` filename prefix to disambiguate: files starting with `audio-` return `audio/ogg`, otherwise `video/ogg`.
- Existing `GET /api/media/stream/:filename` serves audio files after `mimeType()` update — already handles range requests.
- Upload with `replaceFilename` optional body parameter: if provided, the server deletes the old file before storing the new one, making replacement atomic. If the new upload fails, the old file is already gone (acceptable for a localhost app).

### patternMetadata

Current shape:
```json
{ "name": "...", "intensity": "...", "tags": [...], "durationMs": 123 }
```

New shape:
```json
{ "name": "...", "intensity": "...", "tags": [...], "durationMs": 123, "audioFile": "audio-1710720000-description.mp3" }
```

`audioFile` is optional. When null/absent, no audio is attached.

### Audio Cleanup on Pattern Delete

The existing `LibraryService.deleteItem()` calls `this.mediaCleanup.deleteFiles(videoName)`. For custom patterns, `videoName` is a placeholder — there's no actual video file. Audio cleanup requires parsing `patternMetadata`:

1. In `LibraryService.deleteItem()`, after looking up the item, check if `item.patternMetadata` is non-null
2. Parse the JSON and extract `audioFile` if present
3. Call a new `MediaCleanup.deleteAudioFile(filename)` method to delete the audio file
4. Extend the `MediaCleanup` interface: `deleteAudioFile(filename: string): void`

This keeps the cleanup logic in the service layer where it belongs, and the MediaController implements the new interface method.

### API Client

Add to `mediaApi` in `src/lib/apiClient.ts`:
```typescript
uploadAudio(file: File, replaceFilename?: string): Promise<{ name: string; size: number; stored: string }>
deleteAudio(filename: string): Promise<void>
audioStreamUrl(filename: string): string  // returns /api/media/stream/{filename}
```

## Frontend Changes

### Type Changes

Add `audioFile?: string` to `CustomPatternDefinition` in `src/types/patterns.ts`.

**Serialization contract:**
- **On load:** `itemToCustomPattern()` (in `src/types/patterns.ts`) parses `patternMetadata` JSON and maps `audioFile` into the `CustomPatternDefinition` instance. If absent, defaults to `undefined`.
- **On save:** `usePatternEditor.savePattern()` includes `audioFile` in the `patternMetadata` JSON blob alongside `name`, `intensity`, `tags`, `durationMs`.

This keeps `CustomPatternDefinition` as the in-memory model with `patternMetadata` as the persistence format.

### Pattern Editor (usePatternEditor + editor UI)

Add an audio section in the pattern editor:

- **Upload dropzone** — accepts `.mp3`, `.wav`, `.ogg`, max 5MB. Compact single-line style.
- **After upload** — shows filename, file size, and a play/pause preview button with a simple progress indicator.
- **Remove button** — calls `mediaApi.deleteAudio(filename)`, then clears `audioFile` from the pattern state.
- **Replace flow** — uploading when audio already exists calls `mediaApi.uploadAudio(file, existingFilename)` which atomically replaces on the server.
- **Persistence** — `audioFile` stored in `patternMetadata` JSON when the pattern is saved, same as name/intensity/tags.

### Demo Playback (PatternDetailDialog)

When `startDemo` is called for a pattern that has `audioFile` in its metadata:
1. Create `const audio = new Audio(mediaApi.audioStreamUrl(audioFile))`
2. Set `audio.preload = 'auto'` — preload when detail dialog opens to avoid delay on play
3. Call `audio.play()` — plays once, no looping
4. On `stopDemo` or dialog close, call `audio.pause()` and set `audio.src = ''` to release resources

If `audioFile` is set but the file is missing (404), silently skip — play pattern normally.

No UI changes to the detail dialog — the audio just plays automatically.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Upload non-audio file | 400 — rejected by extension check |
| Upload > 5MB | 400 — rejected by multer limit |
| Audio file missing on demo | Silently skip audio, play pattern normally |
| Delete pattern with audio | Audio file cleaned up via `deleteAudioFile()` |
| Upload replaces existing audio | Server deletes old file before storing new one (atomic via `replaceFilename`) |
| Delete endpoint with path traversal attempt | Sanitized via `path.basename()`, verified within `mediaDir` |
| Filename with special characters | Sanitized on upload — only `a-zA-Z0-9._-` allowed |

## New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/media/upload-audio` | Upload audio file (5MB max, optional `replaceFilename`) |
| DELETE | `/api/media/audio/:filename` | Delete an audio file |
