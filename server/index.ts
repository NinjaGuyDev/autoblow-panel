import express from 'express';
import cors from 'cors';
import db from './db/connection.js';
import { initializeSchema } from './db/schema.js';
import { LibraryRepository } from './repositories/library.repository.js';
import { LibraryService } from './services/library.service.js';
import { LibraryController } from './controllers/library.controller.js';
import { createLibraryRouter } from './routes/library.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Initialize database schema
initializeSchema(db);

// Wire up dependency chain
const repository = new LibraryRepository(db);
const service = new LibraryService(repository);
const controller = new LibraryController(service);
const libraryRouter = createLibraryRouter(controller);

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

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
