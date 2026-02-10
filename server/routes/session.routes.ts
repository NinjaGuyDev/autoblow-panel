import { Router } from 'express';
import type { SessionController } from '../controllers/session.controller.js';

export function createSessionRouter(controller: SessionController): Router {
  const router = Router();

  router.get('/stats', controller.getStats);           // specific routes BEFORE /:id
  router.get('/most-played', controller.getMostPlayed);
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.post('/:id/scripts', controller.appendScript);
  router.post('/:id/end', controller.end);
  router.delete('/:id', controller.delete);

  return router;
}
