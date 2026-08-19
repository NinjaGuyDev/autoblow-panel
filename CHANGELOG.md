# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Desktop releases are tagged `desktop-vX.Y.Z` and carry their own version line,
independent of the `vX.Y.Z` tags that publish the Docker image.

## [Unreleased]

## [1.0.0] - 2026-08-19

First desktop release. The application that previously ran only as a local web
server now ships as an installable desktop app, with no behavioural differences
between the two: the same interface, the same backend, the same local database.

### Added

- **Desktop application.** An Electron shell that starts the Express backend as
  a child process on a free port, waits for its health check, and loads the
  interface from it. A single instance lock prevents two copies fighting over
  the same database.
- **Installers for Linux, Windows and macOS** — AppImage and deb, an NSIS
  installer, and a dmg for both Intel and Apple Silicon.
- **Per-user data directories.** The database and uploaded media live in the
  platform's application-data directory rather than beside the binary, so
  installing, updating or removing the app never touches your library.
- **Automated desktop releases.** Pushing a `desktop-v*` tag builds all three
  platforms in parallel, attaches the installers to a GitHub release, and fills
  the release notes from this changelog.

### Changed

- The backend binds to `127.0.0.1` instead of every interface. It was already
  refusing non-local requests in middleware; now it never accepts the connection
  at all. The Docker image is unaffected — nginx reaches it over loopback inside
  the same container.
- The backend can serve the built interface itself when `STATIC_DIR` is set,
  which is how the desktop build serves the app same-origin. Docker still serves
  it through nginx.
- Compiled server tests are no longer emitted into `dist/`, keeping them out of
  the installer and out of the test run.
- `better-sqlite3` upgraded to 13.x, which builds against the V8 version Electron
  ships.
