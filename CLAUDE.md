ALWAYS read autoblow-panel.arc.md once before doing any work or after clearing context

## Project Conventions

### Funscript Data
- `JSON.parse(funscriptData)` returns `{actions: [], version}`, not a raw array. Index `.actions`.

### Canvas
- Do not implement mouse-wheel zoom on canvases; it conflicts with page scroll.
- Canvases use Tailwind `w-full`/`h-auto`, so mouse coordinates are CSS pixels. Scale before hit-testing or drawing: `(clientX - rect.left) * (canvas.width / rect.width)`.

### Testing
- When reading mock call arguments, inspect the last call: `mock.calls[mock.calls.length - 1][0]`.
