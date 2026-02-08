import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { MediaController } from '../controllers/media.controller.js';

export function createMediaRouter(controller: MediaController, mediaDir: string): Router {
  const router = Router();

  // Ensure media and thumbnails directories exist
  fs.mkdirSync(mediaDir, { recursive: true });
  const thumbDir = path.join(mediaDir, 'thumbnails');
  fs.mkdirSync(thumbDir, { recursive: true });

  // Configure multer for video uploads
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (_req, file, cb) => cb(null, file.originalname),
  });

  const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowed = new Set(['.mp4', '.webm', '.ogg', '.mkv', '.avi']);
      cb(null, allowed.has(ext));
    },
    limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10 GB max
  });

  // List available video files
  router.get('/', controller.list);

  // Check if a video file exists (must come before :filename)
  router.get('/check/:filename', controller.check);

  // Stream a video file with range support
  router.get('/stream/:filename', controller.stream);

  // Upload a video file
  router.post('/upload', upload.single('video'), controller.upload);

  // Configure multer for thumbnail uploads
  const thumbStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, thumbDir),
    filename: (_req, file, cb) => {
      // Store as {videoname}.jpg — originalname comes as "videoname.jpg"
      cb(null, file.originalname);
    },
  });

  const thumbUpload = multer({
    storage: thumbStorage,
    fileFilter: (_req, file, cb) => {
      cb(null, file.mimetype === 'image/jpeg');
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  });

  // Get thumbnail for a video
  router.get('/thumbnail/:filename', controller.getThumbnail);

  // Upload thumbnail
  router.post('/thumbnail', thumbUpload.single('thumbnail'), controller.uploadThumbnail);

  return router;
}
