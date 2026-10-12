import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MediaFileService } from '../services/media-file.service.js';

const RECORDED_NAME = 'Ruth Lee On Vacation {Speed 137}.mkv';
const SANITIZED_NAME = 'RuthLeeOnVacationSpeed137.mkv';

describe('MediaFileService', () => {
  let mediaDir: string;
  let service: MediaFileService;

  const writeVideo = (name: string) => fs.writeFileSync(path.join(mediaDir, name), 'video');
  const writeThumbnail = (name: string) => fs.writeFileSync(path.join(mediaDir, 'thumbnails', name), 'jpeg');

  beforeEach(() => {
    mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-file-service-'));
    fs.mkdirSync(path.join(mediaDir, 'thumbnails'));
    service = new MediaFileService(mediaDir);
  });

  afterEach(() => {
    fs.rmSync(mediaDir, { recursive: true, force: true });
  });

  describe('resolveVideoPath', () => {
    it('finds an upload stored under its sanitized name by the name the browser reported', () => {
      writeVideo(SANITIZED_NAME);

      expect(service.resolveVideoPath(RECORDED_NAME)).toBe(path.join(mediaDir, SANITIZED_NAME));
    });

    it('prefers a file stored under the exact recorded name', () => {
      writeVideo(RECORDED_NAME);
      writeVideo(SANITIZED_NAME);

      expect(service.resolveVideoPath(RECORDED_NAME)).toBe(path.join(mediaDir, RECORDED_NAME));
    });

    it('returns null when neither name exists', () => {
      expect(service.resolveVideoPath(RECORDED_NAME)).toBeNull();
    });

    it('never resolves outside the media directory', () => {
      fs.writeFileSync(path.join(path.dirname(mediaDir), 'outside.mp4'), 'video');

      expect(service.resolveVideoPath('../outside.mp4')).toBeNull();
      expect(service.resolveVideoPath('..')).toBeNull();
    });
  });

  describe('resolveThumbnailPath', () => {
    it('finds a thumbnail stored under the sanitized video stem', () => {
      writeThumbnail('RuthLeeOnVacationSpeed137.jpg');

      expect(service.resolveThumbnailPath(RECORDED_NAME))
        .toBe(path.join(mediaDir, 'thumbnails', 'RuthLeeOnVacationSpeed137.jpg'));
    });

    it('still finds a thumbnail stored under the unsanitized stem', () => {
      writeThumbnail('Ruth Lee On Vacation {Speed 137}.jpg');

      expect(service.resolveThumbnailPath(RECORDED_NAME))
        .toBe(path.join(mediaDir, 'thumbnails', 'Ruth Lee On Vacation {Speed 137}.jpg'));
    });
  });

  describe('deleting by recorded name', () => {
    it('removes the sanitized video and thumbnail files', () => {
      writeVideo(SANITIZED_NAME);
      writeThumbnail('RuthLeeOnVacationSpeed137.jpg');

      service.deleteVideoFile(RECORDED_NAME);
      service.deleteThumbnailFile(RECORDED_NAME);

      expect(fs.readdirSync(mediaDir)).toEqual(['thumbnails']);
      expect(fs.readdirSync(path.join(mediaDir, 'thumbnails'))).toEqual([]);
    });

    it('ignores names with no file on disk', () => {
      expect(() => service.deleteVideoFile(RECORDED_NAME)).not.toThrow();
      expect(() => service.deleteThumbnailFile(RECORDED_NAME)).not.toThrow();
    });
  });
});
