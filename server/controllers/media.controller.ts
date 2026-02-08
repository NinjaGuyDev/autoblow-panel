import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mkv', '.avi']);

export class MediaController {
  constructor(private mediaDir: string) {}

  /**
   * GET /api/media — list available video files in media directory
   */
  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!fs.existsSync(this.mediaDir)) {
        res.json({ files: [], mediaDir: this.mediaDir });
        return;
      }

      const entries = fs.readdirSync(this.mediaDir, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
        .map(e => ({
          name: e.name,
          size: fs.statSync(path.join(this.mediaDir, e.name)).size,
        }));

      res.json({ files, mediaDir: this.mediaDir });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/media/check/:filename — check if a video file exists
   */
  check = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = req.params.filename as string;
      const filePath = this.resolveMediaPath(filename);

      if (!filePath) {
        res.json({ exists: false });
        return;
      }

      const stat = fs.statSync(filePath);
      res.json({ exists: true, size: stat.size });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/media/stream/:filename — stream video with range request support
   */
  stream = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = req.params.filename as string;
      const filePath = this.resolveMediaPath(filename);

      if (!filePath) {
        res.status(404).json({ error: 'File not found in media directory' });
        return;
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const ext = path.extname(filename).toLowerCase();
      const contentType = this.mimeType(ext);

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
        });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/media/upload — upload a video file to media directory
   * Expects multipart form data with a 'video' field
   */
  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ error: 'No video file provided' });
        return;
      }

      res.json({
        name: file.originalname,
        size: file.size,
        stored: true,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/media/thumbnail — upload a thumbnail JPEG for a video
   * Expects multipart form data with a 'thumbnail' field and 'videoName' in body
   */
  uploadThumbnail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ error: 'No thumbnail file provided' });
        return;
      }

      res.json({ name: file.originalname, stored: true });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/media/thumbnail/:filename — serve a thumbnail image
   */
  getThumbnail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = req.params.filename as string;
      const thumbName = this.thumbnailName(filename);
      const thumbDir = path.join(this.mediaDir, 'thumbnails');
      const thumbPath = path.join(thumbDir, thumbName);

      if (!thumbPath.startsWith(path.resolve(thumbDir)) || !fs.existsSync(thumbPath)) {
        res.status(404).json({ error: 'Thumbnail not found' });
        return;
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(thumbPath).pipe(res);
    } catch (err) {
      next(err);
    }
  };

  private thumbnailName(videoFilename: string): string {
    const base = path.basename(videoFilename, path.extname(videoFilename));
    return `${base}.jpg`;
  }

  /**
   * Resolve and validate a media file path, preventing directory traversal
   */
  private resolveMediaPath(filename: string): string | null {
    const sanitized = path.basename(filename);
    const filePath = path.join(this.mediaDir, sanitized);

    // Ensure the resolved path is within the media directory
    if (!filePath.startsWith(path.resolve(this.mediaDir))) {
      return null;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return filePath;
  }

  private mimeType(ext: string): string {
    const types: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
    };
    return types[ext] || 'application/octet-stream';
  }
}
