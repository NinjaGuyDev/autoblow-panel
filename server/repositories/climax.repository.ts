import type Database from 'better-sqlite3';
import type { ClimaxRecord, CreateClimaxRecordRequest } from '../types/shared.js';

export class ClimaxRepository {
  constructor(private db: Database.Database) {}

  findAll(): ClimaxRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM climax_records
      ORDER BY createdAt DESC
    `);
    return stmt.all() as ClimaxRecord[];
  }

  findById(id: number): ClimaxRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM climax_records WHERE id = ?
    `);
    return stmt.get(id) as ClimaxRecord | undefined;
  }

  findBySessionId(sessionId: number): ClimaxRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM climax_records
      WHERE sessionId = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(sessionId) as ClimaxRecord[];
  }

  findByLibraryItemId(libraryItemId: number): ClimaxRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM climax_records
      WHERE libraryItemId = ?
      ORDER BY createdAt DESC
    `);
    return stmt.all(libraryItemId) as ClimaxRecord[];
  }

  create(data: CreateClimaxRecordRequest): ClimaxRecord {
    const stmt = this.db.prepare(`
      INSERT INTO climax_records (sessionId, timestamp, runwayData, libraryItemId)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      data.sessionId ?? null,
      data.timestamp,
      data.runwayData,
      data.libraryItemId ?? null
    ) as ClimaxRecord;
  }

  delete(id: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM climax_records WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes;
  }

  countBySessionId(sessionId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM climax_records
      WHERE sessionId = ?
    `);
    const result = stmt.get(sessionId) as { count: number };
    return result.count;
  }

  getClimaxCountByScript(limit: number = 10): Array<{libraryItemId: number, climaxCount: number}> {
    const stmt = this.db.prepare(`
      SELECT
        libraryItemId,
        COUNT(*) as climaxCount
      FROM climax_records
      WHERE libraryItemId IS NOT NULL
      GROUP BY libraryItemId
      ORDER BY climaxCount DESC
      LIMIT ?
    `);
    return stmt.all(limit) as Array<{libraryItemId: number, climaxCount: number}>;
  }
}
