import { Router } from 'express';
import type { PlaylistController } from '../controllers/playlist.controller.js';
import { validateBody } from '../middleware/validate-body.js';
import { CreatePlaylistSchema, UpdatePlaylistSchema, AddPlaylistItemSchema, ReorderPlaylistItemsSchema } from '../schemas/playlist.schemas.js';

export function createPlaylistRouter(controller: PlaylistController): Router {
  const router = Router();

  // Get all playlists
  router.get('/', controller.getAll);

  // Get single playlist by id
  router.get('/:id', controller.getById);

  // Get playlist items (must come before /:id/items/:itemId)
  router.get('/:id/items', controller.getItems);

  // Create new playlist
  router.post('/', validateBody(CreatePlaylistSchema), controller.create);

  // Add item to playlist
  router.post('/:id/items', validateBody(AddPlaylistItemSchema), controller.addItem);

  // Reorder playlist items (must come before /:id/items/:itemId to avoid "reorder" matching as :itemId)
  router.put('/:id/items/reorder', validateBody(ReorderPlaylistItemsSchema), controller.reorderItems);

  // Update playlist
  router.patch('/:id', validateBody(UpdatePlaylistSchema), controller.update);

  // Delete playlist
  router.delete('/:id', controller.delete);

  // Remove item from playlist
  router.delete('/:id/items/:itemId', controller.removeItem);

  return router;
}
