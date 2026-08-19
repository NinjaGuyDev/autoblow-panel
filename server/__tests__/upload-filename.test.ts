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

  it('keeps the extension when the stem is entirely non-ascii', () => {
    // Collapsing the whole name would store an extensionless "mp4", which the
    // media listing filters out and the next such upload overwrites
    expect(sanitizeUploadFilename('видео.mp4', 'video.mp4')).toBe('video.mp4');
    expect(sanitizeUploadFilename('ファイル.jpg', 'thumbnail.jpg')).toBe('thumbnail.jpg');
    expect(sanitizeUploadFilename('视频.mkv', 'video.mp4')).toBe('video.mkv');
  });

  it('always leaves an extension on a name that had one', () => {
    for (const name of ['видео.mp4', '视频.mkv', 'ファイル.jpg', 'ok.webm']) {
      expect(sanitizeUploadFilename(name, 'video.mp4')).toMatch(/\.[a-z0-9]+$/);
    }
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
