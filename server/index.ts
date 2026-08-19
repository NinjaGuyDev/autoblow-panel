import express from 'express';
import cors from 'cors';
import path from 'path';
import db from './db/connection.js';
import { initializeSchema } from './db/schema.js';
import { seedBuiltInScriptMods } from './db/built-in-script-mods.js';
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
import { MediaFileService } from './services/media-file.service.js';
import { localhostOnly } from './middleware/localhost-only.js';
import { createSecurityMiddleware } from './middleware/security.js';
import { createHealthRouter } from './routes/health.js';
import { HealthService } from './services/health.service.js';
import { DeviceService } from './services/device.service.js';
import { PlaybackLoop } from './services/playback-loop.js';
import { DeviceController } from './controllers/device.controller.js';
import { createDeviceRouter } from './routes/device.routes.js';
import Anthropic from '@anthropic-ai/sdk';
import { ScriptModRepository } from './repositories/script-mod.repository.js';
import { ScriptModService } from './services/script-mod.service.js';
import { ModGenerationService } from './services/mod-generation.service.js';
import { ScriptModController } from './controllers/script-mod.controller.js';
import { createScriptModRouter } from './routes/script-mod.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Initialize database schema
initializeSchema(db);

// Ship the built-in script mods so the Mods panel is populated on first run
seedBuiltInScriptMods(db);

// Media directory — configurable for Docker volume mounts and the desktop build
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || './media');

/**
 * Directory holding the built SPA, served by Express itself.
 *
 * Only the desktop build sets this: Electron loads the app over HTTP from this
 * process, so the bundle and the API have to be same-origin. The Docker image
 * leaves it unset because nginx serves the bundle there.
 */
const STATIC_DIR = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;

// Wire up media file service (shared by MediaController and LibraryService)
const mediaFileService = new MediaFileService(MEDIA_DIR);

// Wire up dependency chain
const repository = new LibraryRepository(db);
const service = new LibraryService(repository, mediaFileService);
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

const mediaController = new MediaController(MEDIA_DIR, mediaFileService);
const mediaRouter = createMediaRouter(mediaController, MEDIA_DIR);

// Wire up health service
const healthService = new HealthService(db);
const healthRouter = createHealthRouter(healthService);

// Wire up device control dependency chain
const deviceService = new DeviceService(service, () => new PlaybackLoop());
const deviceController = new DeviceController(deviceService);
const deviceRouter = createDeviceRouter(deviceController);

// Wire up script mod dependency chain.
// Credentials resolve from the `ant auth login` OAuth profile, so the client is
// built per request — a login performed after startup takes effect immediately.
const scriptModRepository = new ScriptModRepository(db);
const scriptModService = new ScriptModService(scriptModRepository);
const modGenerationService = new ModGenerationService(() => new Anthropic());
const scriptModController = new ScriptModController(scriptModService, modGenerationService);
const scriptModRouter = createScriptModRouter(scriptModController);

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

// Static assets of the built SPA, when this process is also the web server
if (STATIC_DIR !== null) {
  app.use(express.static(STATIC_DIR));
}

// Health check endpoint
app.use('/health', healthRouter);

// Mount routes
app.use('/api/library', libraryRouter);
app.use('/api/playlists', playlistRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/device', deviceRouter);
app.use('/api/mods', scriptModRouter);

// SPA fallback for client-side routes. Anchored past the API and health prefixes
// so an unknown endpoint still returns JSON rather than the index document.
if (STATIC_DIR !== null) {
  app.get(/^(?!\/api\/|\/health).*/, (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Start server. Bound to loopback by default: this is a local-only backend, and
// in the Docker image nginx reaches it over 127.0.0.1 inside the same container.
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const server = app.listen(Number(PORT), HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
  console.log(`Media directory: ${MEDIA_DIR}`);
  if (STATIC_DIR !== null) console.log(`Serving app bundle from: ${STATIC_DIR}`);
});

// The desktop build kills this process when the window closes; close the
// listener first so an in-flight upload is not truncated mid-write
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
