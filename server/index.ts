import express from 'express';
import cors from 'cors';
import path from 'path';
import db from './db/connection.js';
import { initializeSchema } from './db/schema.js';
import { LibraryRepository } from './repositories/library.repository.js';
import { LibraryService } from './services/library.service.js';
import { LibraryController } from './controllers/library.controller.js';
import { createLibraryRouter } from './routes/library.routes.js';
import { MediaController } from './controllers/media.controller.js';
import { createMediaRouter } from './routes/media.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Initialize database schema
initializeSchema(db);

// Media directory — configurable for Docker volume mounts
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || './media');

// Wire up dependency chain
const repository = new LibraryRepository(db);
const service = new LibraryService(repository);
const controller = new LibraryController(service);
const libraryRouter = createLibraryRouter(controller);
const mediaController = new MediaController(MEDIA_DIR);
const mediaRouter = createMediaRouter(mediaController, MEDIA_DIR);

// Connect media cleanup to library service for cascading deletes
service.setMediaCleanup(mediaController);

// Create Express app
const app = express();

// Configure CORS for Vite dev server
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Configure JSON body parser with large limit for funscript data
app.use(express.json({ limit: '50mb' }));

// Mount routes
app.use('/api/library', libraryRouter);
app.use('/api/media', mediaRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Media directory: ${MEDIA_DIR}`);
});
