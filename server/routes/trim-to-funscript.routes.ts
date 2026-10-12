import { Router } from 'express';
import type { TrimToFunscriptController } from '../controllers/trim-to-funscript.controller.js';
import { validateBody } from '../middleware/validate-body.js';
import { TrimToFunscriptSchema } from '../schemas/media.schemas.js';

export function createTrimToFunscriptRouter(controller: TrimToFunscriptController): Router {
  const router = Router();

  // Trim a video to where its script starts, saving a new library item
  router.post('/trim-to-funscript', validateBody(TrimToFunscriptSchema), controller.trim);

  return router;
}
