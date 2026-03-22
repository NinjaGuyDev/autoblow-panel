import { Router } from 'express';
import type { SessionController } from '../controllers/session.controller.js';
import { validateBody } from '../middleware/validate-body.js';
import { CreateSessionSchema, UpdateSessionSchema, AppendScriptSchema, EndSessionSchema } from '../schemas/session.schemas.js';

export function createSessionRouter(controller: SessionController): Router {
  const router = Router();

  router.get('/stats', controller.getStats);           // specific routes BEFORE /:id
  router.get('/most-played', controller.getMostPlayed);
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', validateBody(CreateSessionSchema), controller.create);
  router.patch('/:id', validateBody(UpdateSessionSchema), controller.update);
  router.post('/:id/scripts', validateBody(AppendScriptSchema), controller.appendScript);
  router.post('/:id/end', validateBody(EndSessionSchema), controller.end);
  router.delete('/:id', controller.delete);

  return router;
}
