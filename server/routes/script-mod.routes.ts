import { Router } from 'express';
import type { ScriptModController } from '../controllers/script-mod.controller.js';
import { validateBody } from '../middleware/validate-body.js';
import {
  CreateScriptModSchema,
  GenerateScriptModSchema,
  UpdateScriptModSchema,
} from '../schemas/script-mod.schemas.js';

export function createScriptModRouter(controller: ScriptModController): Router {
  const router = Router();

  // List all saved mods
  router.get('/', controller.getAll);

  // Author a mod from natural language (does not persist)
  router.post('/generate', validateBody(GenerateScriptModSchema), controller.generate);

  // Get single mod by id
  router.get('/:id', controller.getById);

  // Create new mod
  router.post('/', validateBody(CreateScriptModSchema), controller.create);

  // Update mod
  router.put('/:id', validateBody(UpdateScriptModSchema), controller.update);

  // Delete mod
  router.delete('/:id', controller.delete);

  return router;
}
