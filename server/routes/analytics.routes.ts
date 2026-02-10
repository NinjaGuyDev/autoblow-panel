import { Router } from 'express';
import type { AnalyticsController } from '../controllers/analytics.controller.js';

export function createAnalyticsRouter(controller: AnalyticsController): Router {
  const router = Router();

  // Climax records
  router.get('/climax-records', controller.getClimaxRecords);
  router.get('/climax-records/by-script', controller.getClimaxCountByScript);
  router.get('/climax-records/:id', controller.getClimaxRecordById);
  router.post('/climax-records', controller.createClimaxRecord);
  router.delete('/climax-records/:id', controller.deleteClimaxRecord);

  // Pause events
  router.get('/pause-events', controller.getPauseEvents);
  router.get('/pause-events/stats', controller.getSessionPauseStats);
  router.post('/pause-events', controller.createPauseEvent);
  router.post('/pause-events/:id/resume', controller.resumePauseEvent);
  router.delete('/pause-events/:id', controller.deletePauseEvent);

  return router;
}
