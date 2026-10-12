import fs from 'fs';
import path from 'path';
import { sanitizeStoredName } from '../lib/uploadFilename.js';

/**
 * Handles filesystem operations for media files (videos, thumbnails, audio).
 * Extracted from MediaController to enable dependency injection into services
 * that need media cleanup without coupling to the HTTP layer.
 *
 * Library rows record the name the browser reported for a video, but uploads
 * are written under their sanitized name, while files copied into the media
 * directory by hand (or uploaded before sanitization existed) keep their
 * original name. Every lookup therefore tries the recorded name first and the
 * sanitized name second.
 */
export class MediaFileService {
  constructor(private mediaDir: string) {}

  /**
   * Resolve a recorded video name to the file on disk.
   * @returns the absolute path, or null when no matching file exists.
   */
  resolveVideoPath(videoName: string): string | null {
    return this.firstExisting(this.mediaDir, this.storedNameCandidates(videoName));
  }

  /**
   * Resolve a recorded video name to its thumbnail JPEG on disk.
   * The client uploads the thumbnail as "<video stem>.jpg", which multer then
   * sanitizes like any other upload.
   * @returns the absolute path, or null when no matching thumbnail exists.
   */
  resolveThumbnailPath(videoName: string): string | null {
    const recorded = path.basename(videoName);
    const thumbnailName = `${path.basename(recorded, path.extname(recorded))}.jpg`;
    return this.firstExisting(this.thumbnailDir(), this.storedNameCandidates(thumbnailName));
  }

  /**
   * Delete a video file from the media directory.
   * Sanitizes the filename to prevent directory traversal.
   */
  deleteVideoFile(filename: string): void {
    this.unlinkIfResolved(this.resolveVideoPath(filename));
  }

  /**
   * Delete the thumbnail JPEG for the given video filename.
   */
  deleteThumbnailFile(filename: string): void {
    this.unlinkIfResolved(this.resolveThumbnailPath(filename));
  }

  /**
   * Delete an audio file from the media directory.
   * Validates the resolved path stays within mediaDir.
   */
  deleteAudioFile(filename: string): void {
    const sanitized = path.basename(filename);
    const filePath = path.join(this.mediaDir, sanitized);
    if (!filePath.startsWith(path.resolve(this.mediaDir))) {
      return;
    }
    this.unlinkIfExists(filePath);
  }

  private thumbnailDir(): string {
    return path.join(this.mediaDir, 'thumbnails');
  }

  /**
   * Basenames a file may be stored under, in lookup order. A name whose stem
   * sanitizes to nothing was stored under the shared upload fallback, which
   * may hold another row's file, so only its exact name is tried.
   */
  private storedNameCandidates(recordedName: string): string[] {
    const recorded = path.basename(recordedName);
    const sanitized = sanitizeStoredName(recordedName);
    return sanitized === null || sanitized === recorded ? [recorded] : [recorded, sanitized];
  }

  private firstExisting(dir: string, names: string[]): string | null {
    const root = path.resolve(dir);
    for (const name of names) {
      const filePath = path.join(root, name);
      if (filePath.startsWith(root + path.sep) && fs.existsSync(filePath)) {
        return filePath;
      }
    }
    return null;
  }

  private unlinkIfResolved(filePath: string | null): void {
    if (filePath) {
      this.unlinkIfExists(filePath);
    }
  }

  /**
   * Attempt to unlink a file, ignoring ENOENT (file already gone).
   * Avoids existsSync+unlinkSync race condition.
   */
  private unlinkIfExists(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
