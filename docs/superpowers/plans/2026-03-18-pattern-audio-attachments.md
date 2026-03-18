# Pattern Audio Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload audio files to custom patterns that play through the browser once when a pattern demo starts.

**Architecture:** Extend existing MediaController with audio upload/delete endpoints. Store audio filename in patternMetadata JSON blob. Add upload UI to PatternEditorDialog. Play audio via HTMLAudioElement on demo start in PatternDetailDialog.

**Tech Stack:** Express/multer (backend), React + HTMLAudioElement (frontend), existing media streaming infrastructure

**Spec:** `docs/superpowers/specs/2026-03-18-pattern-audio-attachments-design.md`

---

## File Structure

```
server/
├── controllers/media.controller.ts    — MODIFY: add uploadAudio, deleteAudio, update mimeType
├── routes/media.routes.ts             — MODIFY: add audio upload/delete routes with multer
├── services/library.service.ts        — MODIFY: extend MediaCleanup, parse audioFile on delete

src/
├── types/patterns.ts                  — MODIFY: add audioFile to CustomPatternDefinition
├── lib/apiClient.ts                   — MODIFY: add uploadAudio, deleteAudio, audioStreamUrl
├── hooks/usePatternEditor.ts          — MODIFY: add audio state, upload/remove handlers, persist
├── components/pattern-library/
│   ├── PatternEditorDialog.tsx         — MODIFY: add audio upload section in editor UI
│   └── PatternDetailDialog.tsx         — MODIFY: play audio on demo start
└── components/pages/PatternLibraryPage.tsx — MODIFY: map audioFile in itemToCustomPattern
```

---

## Chunk 1: Backend — Audio Upload, Stream, Delete

### Task 1: Update MediaController for Audio Support

**Files:**
- Modify: `server/controllers/media.controller.ts`

- [ ] **Step 1: Update mimeType to handle audio extensions**

In `server/controllers/media.controller.ts`, replace the `mimeType` method (line 208-217):

```typescript
  private mimeType(ext: string, filename?: string): string {
    const types: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': filename?.startsWith('audio-') ? 'audio/ogg' : 'video/ogg',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };
    return types[ext] || 'application/octet-stream';
  }
```

Update the `stream` method to pass filename to `mimeType` (line 70):

```typescript
      const contentType = this.mimeType(ext, filename);
```

- [ ] **Step 2: Add uploadAudio handler**

Add after the `uploadThumbnail` method (line 138):

```typescript
  /**
   * POST /api/media/upload-audio — upload an audio file for a pattern
   * Expects multipart form data with an 'audio' field
   * Optional 'replaceFilename' in body to atomically replace an existing file
   */
  uploadAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ error: 'No audio file provided' });
        return;
      }

      // Delete old file if replacing
      const replaceFilename = req.body?.replaceFilename;
      if (replaceFilename) {
        this.deleteAudioFileFromDisk(replaceFilename);
      }

      res.json({
        name: file.originalname,
        size: file.size,
        stored: file.filename, // sanitized filename on disk
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/media/audio/:filename — delete an audio file
   */
  deleteAudioEndpoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = req.params.filename as string;
      this.deleteAudioFileFromDisk(filename);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete an audio file from disk (used by endpoint and MediaCleanup).
   * Sanitizes filename and verifies path is within mediaDir.
   */
  deleteAudioFileFromDisk(filename: string): void {
    const sanitized = path.basename(filename);
    const filePath = path.join(this.mediaDir, sanitized);

    if (!filePath.startsWith(path.resolve(this.mediaDir))) {
      return; // Path traversal attempt — silently ignore
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.server.json`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/media.controller.ts
git commit -m "feat: add audio upload/delete/MIME support to MediaController"
```

---

### Task 2: Add Audio Routes

**Files:**
- Modify: `server/routes/media.routes.ts`

- [ ] **Step 1: Add audio multer config and routes**

In `server/routes/media.routes.ts`, add after the thumbnail upload section (after line 64):

```typescript
  // Configure multer for audio uploads
  const audioStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (_req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
      cb(null, `audio-${Date.now()}-${sanitized}`);
    },
  });

  const audioUpload = multer({
    storage: audioStorage,
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowed = new Set(['.mp3', '.wav', '.ogg']);
      cb(null, allowed.has(ext));
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  });

  // Upload audio file for a pattern
  router.post('/upload-audio', audioUpload.single('audio'), controller.uploadAudio);

  // Delete an audio file
  router.delete('/audio/:filename', controller.deleteAudioEndpoint);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.server.json`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/routes/media.routes.ts
git commit -m "feat: add audio upload and delete routes"
```

---

### Task 3: Extend MediaCleanup for Audio Deletion on Pattern Delete

**Files:**
- Modify: `server/services/library.service.ts`

- [ ] **Step 1: Extend MediaCleanup interface and update deleteItem**

In `server/services/library.service.ts`, update the `MediaCleanup` interface (line 4-6):

```typescript
export interface MediaCleanup {
  deleteFiles(videoName: string): void;
  deleteAudioFileFromDisk(filename: string): void;
}
```

Update `deleteItem` method to parse `patternMetadata` and clean up audio (replace lines 82-100):

```typescript
  deleteItem(id: number): void {
    // Look up item first to get videoName for media cleanup
    const item = this.repository.findById(id);
    if (!item) {
      throw new Error(`Library item with id ${id} not found`);
    }

    this.repository.delete(id);

    // Clean up associated media files
    if (item.videoName && this.mediaCleanup) {
      try {
        this.mediaCleanup.deleteFiles(item.videoName);
      } catch (err) {
        // Log but don't fail the delete — DB record is already gone
        console.warn(`Failed to clean up media files for ${item.videoName}:`, err);
      }
    }

    // Clean up associated audio file from patternMetadata
    if (item.patternMetadata && this.mediaCleanup) {
      try {
        const metadata = JSON.parse(item.patternMetadata);
        if (metadata.audioFile) {
          this.mediaCleanup.deleteAudioFileFromDisk(metadata.audioFile);
        }
      } catch {
        // Malformed metadata — skip audio cleanup
      }
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.server.json`
Expected: No errors.

- [ ] **Step 3: Test server starts**

Run: `cd /home/esfisher/dev/autoblow-panel && timeout 5 npx tsx server/index.ts 2>&1 || true`
Expected: "Server listening on port 3001"

- [ ] **Step 4: Commit**

```bash
git add server/services/library.service.ts
git commit -m "feat: extend MediaCleanup to delete audio files on pattern delete"
```

---

## Chunk 2: Frontend — Types, API Client, Editor UI, Demo Playback

### Task 4: Add audioFile to Frontend Types and API Client

**Files:**
- Modify: `src/types/patterns.ts`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/components/pages/PatternLibraryPage.tsx`

- [ ] **Step 1: Add audioFile to CustomPatternDefinition**

In `src/types/patterns.ts`, add after `libraryItemId` (line 95):

```typescript
  /** Audio file attached to this pattern (filename in media directory) */
  audioFile?: string;
```

- [ ] **Step 2: Add audio methods to API client**

In `src/lib/apiClient.ts`, add to the `mediaApi` object (after `uploadThumbnail`, line 144):

```typescript
  async uploadAudio(file: File, replaceFilename?: string): Promise<{ name: string; size: number; stored: string }> {
    const formData = new FormData();
    formData.append('audio', file);
    if (replaceFilename) {
      formData.append('replaceFilename', replaceFilename);
    }
    return fetchJson(`${MEDIA_BASE}/upload-audio`, { method: 'POST', body: formData });
  },

  async deleteAudio(filename: string): Promise<void> {
    return fetchVoid(`${MEDIA_BASE}/audio/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  },
```

- [ ] **Step 3: Map audioFile in itemToCustomPattern**

In `src/components/pages/PatternLibraryPage.tsx`, update `itemToCustomPattern` (line 27-43) — add `audioFile` to the return object:

```typescript
function itemToCustomPattern(item: LibraryItem): CustomPatternDefinition {
  const parsed = JSON.parse(item.funscriptData);
  const actions = Array.isArray(parsed) ? parsed : parsed.actions || [];
  const metadata = item.patternMetadata ? JSON.parse(item.patternMetadata) : {};

  return {
    id: `custom-${item.id}`,
    name: metadata.name || 'Custom Pattern',
    intensity: metadata.intensity || 'medium',
    tags: metadata.tags || [],
    durationMs: metadata.durationMs || 5000,
    actions,
    isCustom: true,
    originalPatternId: item.originalPatternId || 'unknown',
    lastModified: new Date(item.lastModified).getTime(),
    libraryItemId: item.id,
    audioFile: metadata.audioFile || undefined,
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/patterns.ts src/lib/apiClient.ts src/components/pages/PatternLibraryPage.tsx
git commit -m "feat: add audioFile to pattern types, API client, and mapping"
```

---

### Task 5: Add Audio Upload/Preview to Pattern Editor

**Files:**
- Modify: `src/hooks/usePatternEditor.ts`
- Modify: `src/components/pattern-library/PatternEditorDialog.tsx`

- [ ] **Step 1: Add audio state and handlers to usePatternEditor**

In `src/hooks/usePatternEditor.ts`, add import at top:

```typescript
import { mediaApi } from '@/lib/apiClient';
```

Add state after `ultraRef` (line 22):

```typescript
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioFileSize, setAudioFileSize] = useState<number | null>(null);
```

Add handlers before the `return` (before line 228):

```typescript
  /**
   * Upload an audio file and attach it to the pattern
   */
  const uploadAudio = useCallback(async (file: File) => {
    if (!editedPattern) return;

    try {
      setIsUploadingAudio(true);
      setAudioError(null);

      const result = await mediaApi.uploadAudio(file, editedPattern.audioFile);

      setAudioFileSize(result.size);
      setEditedPattern((prev) => {
        if (!prev) return null;
        return { ...prev, audioFile: result.stored, lastModified: Date.now() };
      });
    } catch (err) {
      setAudioError(getErrorMessage(err, 'Failed to upload audio'));
    } finally {
      setIsUploadingAudio(false);
    }
  }, [editedPattern]);

  /**
   * Remove the attached audio file
   */
  const removeAudio = useCallback(async () => {
    if (!editedPattern?.audioFile) return;

    try {
      setAudioError(null);
      await mediaApi.deleteAudio(editedPattern.audioFile);

      setEditedPattern((prev) => {
        if (!prev) return null;
        return { ...prev, audioFile: undefined, lastModified: Date.now() };
      });
    } catch (err) {
      setAudioError(getErrorMessage(err, 'Failed to remove audio'));
    }
  }, [editedPattern]);
```

Include `audioFile` in the `patternMetadata` JSON inside `savePattern` (update lines 182-187):

```typescript
      const patternMetadata = JSON.stringify({
        name: editedPattern.name,
        intensity: editedPattern.intensity,
        tags: editedPattern.tags,
        durationMs: editedPattern.durationMs,
        ...(editedPattern.audioFile ? { audioFile: editedPattern.audioFile } : {}),
      });
```

Add to the return object:

```typescript
    isUploadingAudio,
    audioError,
    audioFileSize,
    uploadAudio,
    removeAudio,
```

- [ ] **Step 2: Add audio section to PatternEditorDialog**

In `src/components/pattern-library/PatternEditorDialog.tsx`, add imports at top:

```typescript
import { useRef, useState } from 'react';  // add useRef, useState to existing import
import { mediaApi } from '@/lib/apiClient';
```

Add to the props interface:

```typescript
  audioFile?: string;
  audioFileSize?: number;
  isUploadingAudio: boolean;
  audioError: string | null;
  onUploadAudio: (file: File) => void;
  onRemoveAudio: () => void;
```

Inside the component function, add audio preview state:

```typescript
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const togglePreview = () => {
    if (!audioFile) return;
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPreviewPlaying(false);
    } else {
      const audio = new Audio(mediaApi.streamUrl(audioFile));
      audio.addEventListener('ended', () => setIsPreviewPlaying(false));
      audio.play().catch(() => {});
      previewAudioRef.current = audio;
      setIsPreviewPlaying(true);
    }
  };
```

Add the audio upload section after the controls row `</div>` (after line 231):

```typescript
      {/* Audio attachment */}
      <div className="mb-4">
        <label className="text-xs text-stone-500 block mb-1">Audio Description</label>
        {audioFile ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded bg-stone-800 border border-stone-700">
            <button
              onClick={togglePreview}
              className="text-amber-500 hover:text-amber-400 transition-colors"
            >
              {isPreviewPlaying ? '⏸' : '▶'}
            </button>
            <span className="text-stone-300 text-sm truncate flex-1">{audioFile}</span>
            {audioFileSize && (
              <span className="text-stone-500 text-xs">{(audioFileSize / 1024).toFixed(0)} KB</span>
            )}
            <button
              onClick={onRemoveAudio}
              className="text-stone-500 hover:text-red-400 transition-colors text-sm"
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-stone-800 border border-stone-700 border-dashed cursor-pointer hover:border-amber-700/40 transition-colors">
            <span className="text-stone-400 text-sm">
              {isUploadingAudio ? 'Uploading...' : 'Drop or click to attach audio (.mp3, .wav, .ogg)'}
            </span>
            <input
              type="file"
              accept=".mp3,.wav,.ogg"
              className="hidden"
              disabled={isUploadingAudio}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadAudio(file);
                e.target.value = '';
              }}
            />
          </label>
        )}
        {audioError && (
          <p className="text-red-400 text-xs mt-1">{audioError}</p>
        )}
      </div>
```

- [ ] **Step 3: Wire props in PatternLibraryPage**

In `src/components/pages/PatternLibraryPage.tsx`, update the `PatternEditorDialog` usage to pass the new props. Find where `<PatternEditorDialog` is rendered and add:

```typescript
  audioFile={patternEditor.editedPattern?.audioFile}
  audioFileSize={patternEditor.audioFileSize ?? undefined}
  isUploadingAudio={patternEditor.isUploadingAudio}
  audioError={patternEditor.audioError}
  onUploadAudio={patternEditor.uploadAudio}
  onRemoveAudio={patternEditor.removeAudio}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePatternEditor.ts src/components/pattern-library/PatternEditorDialog.tsx src/components/pages/PatternLibraryPage.tsx
git commit -m "feat: add audio upload/preview/remove to pattern editor"
```

---

### Task 6: Play Audio on Demo Start in PatternDetailDialog

**Files:**
- Modify: `src/components/pattern-library/PatternDetailDialog.tsx`

- [ ] **Step 1: Add audio playback to demo lifecycle**

In `src/components/pattern-library/PatternDetailDialog.tsx`, add import:

```typescript
import { mediaApi } from '@/lib/apiClient';
```

Add a ref for the audio element (after existing refs, around line 40):

```typescript
  const audioRef = useRef<HTMLAudioElement | null>(null);
```

In the `startDemo` callback (around line 128), after `setIsDemoPlaying(true)` (line 173), add:

```typescript
      // Play attached audio if present (once, no looping)
      if (isCustomPattern(pattern) && pattern.audioFile) {
        const audio = new Audio(mediaApi.streamUrl(pattern.audioFile));
        audio.preload = 'auto';
        audio.play().catch(() => {}); // Silently skip if file missing
        audioRef.current = audio;
      }
```

Add the `isCustomPattern` import if not already present:

```typescript
import { type AnyPattern, isCustomPattern, getPatternActions } from '@/types/patterns';
```

In the `stopDemo` callback (around line 179), before or after `setIsDemoPlaying(false)`, add:

```typescript
      // Stop attached audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
```

In the cleanup effect for dialog close (around line 193), add the same audio cleanup:

```typescript
  useEffect(() => {
    if (!isOpen && isDemoPlaying) {
      stopDemo();
    }
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, [isOpen, isDemoPlaying, stopDemo]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pattern-library/PatternDetailDialog.tsx
git commit -m "feat: play attached audio on pattern demo start"
```

---

### Task 7: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test audio upload endpoint**

```bash
# Create a test audio file
echo "test" > /tmp/test.mp3
curl -s -X POST http://localhost:3001/api/media/upload-audio \
  -F "audio=@/tmp/test.mp3" | python3 -m json.tool
```

Expected: `{ "name": "test.mp3", "size": ..., "stored": "audio-...-test.mp3" }`

- [ ] **Step 3: Test audio delete endpoint**

```bash
# Use the stored filename from step 2
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:3001/api/media/audio/audio-...-test.mp3
```

Expected: 204

- [ ] **Step 4: Test audio streaming**

Upload a real mp3 file, then:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/media/stream/audio-...-test.mp3
```

Expected: 200 with `Content-Type: audio/mpeg`

- [ ] **Step 5: Test in browser**

1. Open Pattern Library → edit a custom pattern
2. Upload an audio file via the new upload area
3. Verify filename appears with play button
4. Click play to preview
5. Save the pattern
6. Open detail dialog → click Demo → verify audio plays
7. Stop demo → verify audio stops
8. Edit pattern → remove audio → save → verify it's gone
