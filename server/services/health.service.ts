import type Database from 'better-sqlite3';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
  };
}

/**
 * Encapsulates health check logic, removing direct database imports
 * from the health route module.
 */
export class HealthService {
  constructor(private db: Database.Database) {}

  checkHealth(): HealthCheckResult {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    let dbStatus: 'ok' | 'error' = 'ok';
    let overallStatus: 'ok' | 'error' = 'ok';

    try {
      this.db.prepare('SELECT 1').get();
    } catch (error) {
      console.error('[HEALTH] Database check failed:', error);
      dbStatus = 'error';
      overallStatus = 'error';
    }

    return {
      status: overallStatus,
      timestamp,
      uptime,
      checks: {
        database: dbStatus,
      },
    };
  }
}
