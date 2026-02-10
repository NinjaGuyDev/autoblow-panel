import type Database from 'better-sqlite3';
import type { Session, CreateSessionRequest, UpdateSessionRequest, SessionStats, MostPlayedScript } from '../types/shared.js';

export class SessionRepository {
  constructor(private db: Database.Database) {}

  findAll(): Session[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      ORDER BY startedAt DESC
    `);
    return stmt.all() as Session[];
  }

  findById(id: number): Session | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);
    return stmt.get(id) as Session | undefined;
  }

  findByDateRange(startDate: string, endDate: string): Session[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE startedAt >= ? AND startedAt < ?
      ORDER BY startedAt DESC
    `);
    return stmt.all(startDate, endDate) as Session[];
  }

  create(data: CreateSessionRequest): Session {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (startedAt, libraryItemId, context, scriptOrder)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      data.startedAt,
      data.libraryItemId ?? null,
      data.context,
      data.scriptOrder ?? '[]'
    ) as Session;
  }

  update(id: number, data: UpdateSessionRequest): Session {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET endedAt = COALESCE(?, endedAt),
          durationSeconds = COALESCE(?, durationSeconds),
          scriptOrder = COALESCE(?, scriptOrder)
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(
      data.endedAt ?? null,
      data.durationSeconds ?? null,
      data.scriptOrder ?? null,
      id
    ) as Session;
  }

  delete(id: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM sessions WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes;
  }

  getStats(context?: string): SessionStats {
    const whereClause = context ? 'WHERE context = ?' : 'WHERE context = ?';
    const contextValue = context ?? 'normal';

    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalSessions,
        COALESCE(SUM(durationSeconds), 0) as totalDurationSeconds,
        COALESCE(AVG(durationSeconds), 0) as avgDurationSeconds
      FROM sessions
      ${whereClause}
    `);
    return stmt.get(contextValue) as SessionStats;
  }

  getMostPlayed(limit: number = 10): MostPlayedScript[] {
    const stmt = this.db.prepare(`
      SELECT
        libraryItemId,
        COUNT(*) as playCount,
        COALESCE(SUM(durationSeconds), 0) as totalDurationSeconds
      FROM sessions
      WHERE libraryItemId IS NOT NULL
        AND context = 'normal'
      GROUP BY libraryItemId
      ORDER BY playCount DESC
      LIMIT ?
    `);
    return stmt.all(limit) as MostPlayedScript[];
  }
}
