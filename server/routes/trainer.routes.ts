import { Router } from 'express';
import type { TrainerController } from '../controllers/trainer.controller.js';
import { validateBody } from '../middleware/validate-body.js';
import { CreateTrainerRankingSchema } from '../schemas/trainer.schemas.js';

export function createTrainerRouter(controller: TrainerController): Router {
  const router = Router();

  // List trainer patterns with their average rank and rank count
  router.get('/patterns', controller.getPatterns);

  // Record one rank for a pattern
  router.post('/patterns/:id/rankings', validateBody(CreateTrainerRankingSchema), controller.rankPattern);

  return router;
}
