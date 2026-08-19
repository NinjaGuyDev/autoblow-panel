import { describe, it, expect } from 'vitest';
import { sanitizeUploadFilename } from '../lib/uploadFilename.js';

describe('sanitizeUploadFilename', () => {
  it('leaves an ordinary filename untouched', () => {
    expect(sanitizeUploadFilename('My_Video-01.mp4', 'video.mp4')).toBe('My_Video-01.mp4');
  });

  it('strips posix traversal segments', () => {
    expect(sanitizeUploadFilename('../../../../home/esfisher/.bashrc.mp4', 'video.mp4'))
      .toBe('bashrc.mp4');
  });

  it('strips windows-style separators', () => {
    expect(sanitizeUploadFilename('..\\..\\windows\\system32\\evil.mp4', 'video.mp4'))
      .toBe('evil.mp4');
  });

  it('drops characters outside the allowlist', () => {
    expect(sanitizeUploadFilename('re;boot $(whoami).mp4', 'video.mp4')).toBe('rebootwhoami.mp4');
  });

  it('never yields a dotfile', () => {
    expect(sanitizeUploadFilename('.bashrc', 'video.mp4')).toBe('bashrc');
    expect(sanitizeUploadFilename('...', 'video.mp4')).toBe('video.mp4');
  });

  it('falls back when nothing usable survives', () => {
    expect(sanitizeUploadFilename('../', 'video.mp4')).toBe('video.mp4');
    expect(sanitizeUploadFilename('', 'thumbnail.jpg')).toBe('thumbnail.jpg');
    expect(sanitizeUploadFilename('/////', 'audio')).toBe('audio');
  });

  it('keeps the name a basename, so it cannot escape the destination directory', () => {
    for (const name of ['../x.mp4', 'a/b/c.mp4', '/etc/passwd.mp4', 'C:\\x.mp4']) {
      expect(sanitizeUploadFilename(name, 'video.mp4')).not.toContain('/');
      expect(sanitizeUploadFilename(name, 'video.mp4')).not.toContain('\\');
      expect(sanitizeUploadFilename(name, 'video.mp4')).not.toContain('..');
    }
  });
});
