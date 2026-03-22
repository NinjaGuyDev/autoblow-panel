import type Database from 'better-sqlite3';
import type { Session, CreateSessionRequest, UpdateSessionRequest, SessionStats, MostPlayedScript } from '../types/shared.js';

export class SessionRepository {
  private readonly findAllStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findByDateRangeStmt: Database.Statement;
  private readonly createStmt: Database.Statement;
  private readonly updateStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly getStatsByContextStmt: Database.Statement;
  private readonly getStatsAllStmt: Database.Statement;
  private readonly getMostPlayedStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.findAllStmt = db.prepare(`
      SELECT * FROM sessions
      ORDER BY startedAt DESC
    `);

    this.findByIdStmt = db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);

    this.findByDateRangeStmt = db.prepare(`
      SELECT * FROM sessions
      WHERE startedAt >= ? AND startedAt < ?
      ORDER BY startedAt DESC
    `);

    this.createStmt = db.prepare(`
      INSERT INTO sessions (startedAt, libraryItemId, context, scriptOrder)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    this.updateStmt = db.prepare(`
      UPDATE sessions
      SET endedAt = COALESCE(?, endedAt),
          durationSeconds = COALESCE(?, durationSeconds),
          scriptOrder = COALESCE(?, scriptOrder)
      WHERE id = ?
      RETURNING *
    `);

    this.deleteStmt = db.prepare(`
      DELETE FROM sessions WHERE id = ?
    `);

    this.getStatsByContextStmt = db.prepare(`
      SELECT
        COUNT(*) as totalSessions,
        COALESCE(SUM(durationSeconds), 0) as totalDurationSeconds,
        COALESCE(AVG(durationSeconds), 0) as avgDurationSeconds
      FROM sessions
      WHERE context = ?
    `);

    this.getStatsAllStmt = db.prepare(`
      SELECT
        COUNT(*) as totalSessions,
        COALESCE(SUM(durationSeconds), 0) as totalDurationSeconds,
        COALESCE(AVG(durationSeconds), 0) as avgDurationSeconds
      FROM sessions
    `);

    this.getMostPlayedStmt = db.prepare(`
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
  }

  findAll(): Session[] {
    return this.findAllStmt.all() as Session[];
  }

  findById(id: number): Session | undefined {
    return this.findByIdStmt.get(id) as Session | undefined;
  }

  findByDateRange(startDate: string, endDate: string): Session[] {
    return this.findByDateRangeStmt.all(startDate, endDate) as Session[];
  }

  create(data: CreateSessionRequest): Session {
    return this.createStmt.get(
      data.startedAt,
      data.libraryItemId ?? null,
      data.context,
      data.scriptOrder ?? '[]'
    ) as Session;
  }

  update(id: number, data: UpdateSessionRequest): Session {
    return this.updateStmt.get(
      data.endedAt ?? null,
      data.durationSeconds ?? null,
      data.scriptOrder ?? null,
      id
    ) as Session;
  }

  delete(id: number): number {
    const result = this.deleteStmt.run(id);
    return result.changes;
  }

  getStats(context?: string): SessionStats {
    if (context) {
      return this.getStatsByContextStmt.get(context) as SessionStats;
    }
    return this.getStatsAllStmt.get() as SessionStats;
  }

  getMostPlayed(limit: number = 10): MostPlayedScript[] {
    return this.getMostPlayedStmt.all(limit) as MostPlayedScript[];
  }
}
