import express from 'express';
import cors from 'cors';
import path from 'path';
import db from './db/connection.js';
import { initializeSchema } from './db/schema.js';
import { LibraryRepository } from './repositories/library.repository.js';
import { LibraryService } from './services/library.service.js';
import { LibraryController } from './controllers/library.controller.js';
import { createLibraryRouter } from './routes/library.routes.js';
import { PlaylistRepository } from './repositories/playlist.repository.js';
import { PlaylistService } from './services/playlist.service.js';
import { PlaylistController } from './controllers/playlist.controller.js';
import { createPlaylistRouter } from './routes/playlist.routes.js';
import { SessionRepository } from './repositories/session.repository.js';
import { SessionService } from './services/session.service.js';
import { SessionController } from './controllers/session.controller.js';
import { createSessionRouter } from './routes/session.routes.js';
import { ClimaxRepository } from './repositories/climax.repository.js';
import { PauseEventRepository } from './repositories/pause-event.repository.js';
import { ClimaxService } from './services/climax.service.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { createAnalyticsRouter } from './routes/analytics.routes.js';
import { MediaController } from './controllers/media.controller.js';
import { createMediaRouter } from './routes/media.routes.js';
import { localhostOnly } from './middleware/localhost-only.js';
import { createSecurityMiddleware } from './middleware/security.js';
import healthRouter from './routes/health.js';
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

// Wire up playlist dependency chain
const playlistRepository = new PlaylistRepository(db);
const playlistService = new PlaylistService(playlistRepository, repository);
const playlistController = new PlaylistController(playlistService);
const playlistRouter = createPlaylistRouter(playlistController);

// Wire up session dependency chain
const sessionRepository = new SessionRepository(db);
const sessionService = new SessionService(sessionRepository);
const sessionController = new SessionController(sessionService);
const sessionRouter = createSessionRouter(sessionController);

// Wire up analytics dependency chain
const climaxRepository = new ClimaxRepository(db);
const pauseEventRepository = new PauseEventRepository(db);
const climaxService = new ClimaxService(climaxRepository, pauseEventRepository);
const analyticsController = new AnalyticsController(climaxService);
const analyticsRouter = createAnalyticsRouter(analyticsController);

const mediaController = new MediaController(MEDIA_DIR);
const mediaRouter = createMediaRouter(mediaController, MEDIA_DIR);

// Connect media cleanup to library service for cascading deletes
service.setMediaCleanup(mediaController);

// Create Express app
const app = express();

// Apply localhost-only validation before CORS
app.use(localhostOnly);

// Apply security headers in production mode only (prevents CSP from breaking Vite HMR)
if (process.env.NODE_ENV === 'production') {
  app.use(createSecurityMiddleware());
}

// Configure CORS for Vite dev server (not needed in production — nginx serves same-origin)
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
}

// Configure JSON body parser with large limit for funscript data
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.use('/health', healthRouter);

// Mount routes
app.use('/api/library', libraryRouter);
app.use('/api/playlists', playlistRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/media', mediaRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Media directory: ${MEDIA_DIR}`);
});
