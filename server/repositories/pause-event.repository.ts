import type Database from 'better-sqlite3';
import type { PauseEvent, CreatePauseEventRequest, UpdatePauseEventRequest } from '../types/shared.js';

export class PauseEventRepository {
  private readonly findBySessionIdStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly createStmt: Database.Statement;
  private readonly updateStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly avgPauseDurationStmt: Database.Statement;
  private readonly totalPausesBySessionStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.findBySessionIdStmt = db.prepare(`
      SELECT * FROM pause_events
      WHERE sessionId = ?
      ORDER BY timestamp ASC
    `);

    this.findByIdStmt = db.prepare(`
      SELECT * FROM pause_events WHERE id = ?
    `);

    this.createStmt = db.prepare(`
      INSERT INTO pause_events (sessionId, timestamp)
      VALUES (?, ?)
      RETURNING *
    `);

    this.updateStmt = db.prepare(`
      UPDATE pause_events
      SET resumedAt = COALESCE(?, resumedAt),
          durationSeconds = COALESCE(?, durationSeconds)
      WHERE id = ?
      RETURNING *
    `);

    this.deleteStmt = db.prepare(`
      DELETE FROM pause_events WHERE id = ?
    `);

    this.avgPauseDurationStmt = db.prepare(`
      SELECT COALESCE(AVG(durationSeconds), 0) as avgDuration
      FROM pause_events
      WHERE sessionId = ? AND durationSeconds IS NOT NULL
    `);

    this.totalPausesBySessionStmt = db.prepare(`
      SELECT COUNT(*) as count FROM pause_events
      WHERE sessionId = ?
    `);
  }

  findBySessionId(sessionId: number): PauseEvent[] {
    return this.findBySessionIdStmt.all(sessionId) as PauseEvent[];
  }

  findById(id: number): PauseEvent | undefined {
    return this.findByIdStmt.get(id) as PauseEvent | undefined;
  }

  create(data: CreatePauseEventRequest): PauseEvent {
    return this.createStmt.get(
      data.sessionId,
      data.timestamp
    ) as PauseEvent;
  }

  update(id: number, data: UpdatePauseEventRequest): PauseEvent {
    return this.updateStmt.get(
      data.resumedAt ?? null,
      data.durationSeconds ?? null,
      id
    ) as PauseEvent;
  }

  delete(id: number): number {
    const result = this.deleteStmt.run(id);
    return result.changes;
  }

  getAvgPauseDuration(sessionId: number): number {
    const result = this.avgPauseDurationStmt.get(sessionId) as { avgDuration: number };
    return result.avgDuration;
  }

  getTotalPausesBySession(sessionId: number): number {
    const result = this.totalPausesBySessionStmt.get(sessionId) as { count: number };
    return result.count;
  }
}
