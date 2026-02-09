import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

/**
 * Health check endpoint with database connectivity verification.
 * Returns 200 OK if all checks pass, 503 Service Unavailable on error.
 */
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  // Test database connectivity
  let dbStatus: 'ok' | 'error' = 'ok';
  let overallStatus: 'ok' | 'error' = 'ok';

  try {
    db.prepare('SELECT 1').get();
  } catch (error) {
    console.error('[HEALTH] Database check failed:', error);
    dbStatus = 'error';
    overallStatus = 'error';
  }

  if (overallStatus === 'error') {
    res.status(503).json({
      status: 'error',
      timestamp,
      uptime,
      checks: {
        database: dbStatus
      }
    });
  } else {
    res.status(200).json({
      status: 'ok',
      timestamp,
      uptime,
      checks: {
        database: dbStatus
      }
    });
  }
});

export default router;
