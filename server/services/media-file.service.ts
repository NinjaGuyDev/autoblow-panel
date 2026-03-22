import fs from 'fs';
import path from 'path';

/**
 * Handles filesystem operations for media files (videos, thumbnails, audio).
 * Extracted from MediaController to enable dependency injection into services
 * that need media cleanup without coupling to the HTTP layer.
 */
export class MediaFileService {
  constructor(private mediaDir: string) {}

  /**
   * Delete a video file from the media directory.
   * Sanitizes the filename to prevent directory traversal.
   */
  deleteVideoFile(filename: string): void {
    const sanitized = path.basename(filename);
    const videoPath = path.join(this.mediaDir, sanitized);
    this.unlinkIfExists(videoPath);
  }

  /**
   * Delete a thumbnail JPEG for the given video filename.
   * Derives the thumbnail name by replacing the video extension with .jpg.
   */
  deleteThumbnailFile(filename: string): void {
    const sanitized = path.basename(filename);
    const base = path.basename(sanitized, path.extname(sanitized));
    const thumbPath = path.join(this.mediaDir, 'thumbnails', `${base}.jpg`);
    this.unlinkIfExists(thumbPath);
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
