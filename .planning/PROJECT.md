# Autoblow Panel

## What This Is

A privacy-first web interface for the Autoblow AI Ultra device that provides video-synced funscript playback, visual motion pattern editing, and real-time device testing. Users can load local video files, sync them with funscripts, visually preview and edit motion patterns on a timeline, and test motions in real-time on their device - all without cloud services or uploads.

## Core Value

Smooth, privacy-preserving funscript playback synced with local video content.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Load local video files (MP4, WebM, etc.) into the interface
- [ ] Auto-detect matching funscript files (same filename, .funscript extension)
- [ ] Manually load/select funscript files
- [ ] Play video with synchronized funscript execution on device
- [ ] Visual timeline editor displaying motion patterns as a graph
- [ ] Real-time device control via autoblow-js-sdk
- [ ] Browse and preview motion pattern library (motions/ directory)
- [ ] Load preset patterns into timeline
- [ ] Draw motion curves directly on timeline
- [ ] Edit individual action points (add, remove, adjust position/timing)
- [ ] Export edited/created funscripts as .funscript files
- [ ] Manual device controls for testing individual motions
- [ ] Visual feedback showing current playback position on timeline
- [ ] Pause/resume/seek controls affecting both video and device sync

### Out of Scope

- Cloud storage or streaming — Privacy is core, everything stays local
- User accounts or authentication — Single-user, local tool
- Mobile app — Web-based only for v1
- Multi-device support — Autoblow AI Ultra only for v1
- Social/sharing features — Private tool for personal use
- Pattern marketplace or community features — Privacy-focused, no external connections

## Context

**Existing Assets:**
- 35+ pre-built motion patterns in motions/ directory (wave-up-slow, surge-down, bounce-up, etc.)
- Sample funscripts demonstrating various patterns and complexities
- Funscript format: JSON with `version`, `inverted`, `range`, and `actions` array containing `{pos, at}` pairs where `pos` is position 0-100 and `at` is time in milliseconds

**Technical Environment:**
- Target device: Autoblow AI Ultra
- SDK: autoblow-js-sdk (https://developers.autoblow.com/guides/autoblow-js-sdk/)
- Development reference: whatcom383/autoblow-ultra-playground
- UI inspiration: funscript.io (dark theme, visual timeline editor, clean controls)

**User Intent:**
- Personal use for testing and enjoying content
- Privacy is paramount - no uploads, tracking, or external services
- Streamline workflow for testing existing patterns and creating custom synced content

## Constraints

- **Privacy**: All local processing, no cloud services, no uploads, no tracking, no analytics
- **Tech Stack**: Web-based (browser), must use autoblow-js-sdk for device communication
- **UI/UX**: Dark/modern theme, visual timeline editor with graph-based motion display, simple and intuitive controls
- **File Format**: Must support standard funscript format (JSON with actions array)
- **Device**: Autoblow AI Ultra only (other devices out of scope for v1)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Privacy-first local architecture | User's core requirement - no cloud, no uploads, complete privacy | — Pending |
| Visual timeline editor | Inspired by funscript.io - intuitive way to see and edit motion patterns over time | — Pending |
| Web-based interface | Cross-platform, no installation, works on any device with browser and autoblow-js-sdk support | — Pending |

---
*Last updated: 2026-02-06 after initialization*
