import { Router } from 'express';
import type { LibraryController } from '../controllers/library.controller.js';

export function createLibraryRouter(controller: LibraryController): Router {
  const router = Router();

  // Get all library items
  router.get('/', controller.getAll);

  // Search library items (must come before /:id)
  router.get('/search', controller.search);

  // Get migration status (must come before /:id)
  router.get('/migration-status', controller.getMigrationStatus);

  // Get single library item by id
  router.get('/:id', controller.getById);

  // Create new library item
  router.post('/', controller.create);

  // Migrate from IndexedDB
  router.post('/migrate', controller.migrate);

  // Save or update library item
  router.put('/', controller.save);

  // Delete library item
  router.delete('/:id', controller.delete);

  return router;
}
