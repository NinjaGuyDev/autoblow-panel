import { Router } from 'express';
import type { HealthService } from '../services/health.service.js';

/**
 * Health check endpoint with database connectivity verification.
 * Returns 200 OK if all checks pass, 503 Service Unavailable on error.
 */
export function createHealthRouter(healthService: HealthService): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const result = healthService.checkHealth();
    const statusCode = result.status === 'error' ? 503 : 200;
    res.status(statusCode).json(result);
  });

  return router;
}
