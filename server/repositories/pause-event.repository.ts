import type Database from 'better-sqlite3';
import type { PauseEvent, CreatePauseEventRequest, UpdatePauseEventRequest } from '../types/shared.js';

export class PauseEventRepository {
  constructor(private db: Database.Database) {}

  findBySessionId(sessionId: number): PauseEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pause_events
      WHERE sessionId = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(sessionId) as PauseEvent[];
  }

  findById(id: number): PauseEvent | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM pause_events WHERE id = ?
    `);
    return stmt.get(id) as PauseEvent | undefined;
  }

  create(data: CreatePauseEventRequest): PauseEvent {
    const stmt = this.db.prepare(`
      INSERT INTO pause_events (sessionId, timestamp)
      VALUES (?, ?)
      RETURNING *
    `);
    return stmt.get(
      data.sessionId,
      data.timestamp
    ) as PauseEvent;
  }

  update(id: number, data: UpdatePauseEventRequest): PauseEvent {
    const stmt = this.db.prepare(`
      UPDATE pause_events
      SET resumedAt = COALESCE(?, resumedAt),
          durationSeconds = COALESCE(?, durationSeconds)
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(
      data.resumedAt ?? null,
      data.durationSeconds ?? null,
      id
    ) as PauseEvent;
  }

  delete(id: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM pause_events WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes;
  }

  getAvgPauseDuration(sessionId: number): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(AVG(durationSeconds), 0) as avgDuration
      FROM pause_events
      WHERE sessionId = ? AND durationSeconds IS NOT NULL
    `);
    const result = stmt.get(sessionId) as { avgDuration: number };
    return result.avgDuration;
  }

  getTotalPausesBySession(sessionId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM pause_events
      WHERE sessionId = ?
    `);
    const result = stmt.get(sessionId) as { count: number };
    return result.count;
  }
}
