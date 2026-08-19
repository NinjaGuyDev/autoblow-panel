import { describe, it, expect } from 'vitest';
import { extractChangelogSection } from '../extract-changelog.js';

const CHANGELOG = `# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

- Nothing yet.

## [1.0.0] - 2026-08-19

### Added

- Desktop application built on Electron.
- Installers for Linux, Windows and macOS.

### Changed

- Backend binds to loopback.

## [0.9.0] - 2026-07-01

- Earlier release.
`;

describe('extractChangelogSection', () => {
  it('returns the body of the requested version without its heading', () => {
    const section = extractChangelogSection(CHANGELOG, '1.0.0');

    expect(section.startsWith('### Added')).toBe(true);
    expect(section).toContain('Desktop application built on Electron.');
    expect(section).toContain('Backend binds to loopback.');
  });

  it('stops at the next version heading', () => {
    const section = extractChangelogSection(CHANGELOG, '1.0.0');

    expect(section).not.toContain('Earlier release.');
    expect(section).not.toContain('0.9.0');
  });

  it('accepts a tag-style version with a leading v', () => {
    expect(extractChangelogSection(CHANGELOG, 'v1.0.0'))
      .toBe(extractChangelogSection(CHANGELOG, '1.0.0'));
  });

  it('reads the last section when nothing follows it', () => {
    expect(extractChangelogSection(CHANGELOG, '0.9.0')).toBe('- Earlier release.');
  });

  it('does not confuse a version with one that shares its prefix', () => {
    const changelog = '## [1.0.0]\n\n- real\n\n## [1.0.0-beta.1]\n\n- beta\n';

    expect(extractChangelogSection(changelog, '1.0.0')).toBe('- real');
    expect(extractChangelogSection(changelog, '1.0.0-beta.1')).toBe('- beta');
  });

  it('throws when the version has no section', () => {
    expect(() => extractChangelogSection(CHANGELOG, '2.0.0'))
      .toThrow('CHANGELOG.md has no section for version 2.0.0');
  });
});
