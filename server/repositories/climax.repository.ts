import type Database from 'better-sqlite3';
import type { ClimaxRecord, CreateClimaxRecordRequest } from '../types/shared.js';

export class ClimaxRepository {
  private readonly findAllStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findBySessionIdStmt: Database.Statement;
  private readonly findByLibraryItemIdStmt: Database.Statement;
  private readonly createStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly climaxCountByScriptStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.findAllStmt = db.prepare(`
      SELECT * FROM climax_records
      ORDER BY createdAt DESC
    `);

    this.findByIdStmt = db.prepare(`
      SELECT * FROM climax_records WHERE id = ?
    `);

    this.findBySessionIdStmt = db.prepare(`
      SELECT * FROM climax_records
      WHERE sessionId = ?
      ORDER BY timestamp ASC
    `);

    this.findByLibraryItemIdStmt = db.prepare(`
      SELECT * FROM climax_records
      WHERE libraryItemId = ?
      ORDER BY createdAt DESC
    `);

    this.createStmt = db.prepare(`
      INSERT INTO climax_records (sessionId, timestamp, runwayData, libraryItemId)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    this.deleteStmt = db.prepare(`
      DELETE FROM climax_records WHERE id = ?
    `);

    this.climaxCountByScriptStmt = db.prepare(`
      SELECT
        libraryItemId,
        COUNT(*) as climaxCount
      FROM climax_records
      WHERE libraryItemId IS NOT NULL
      GROUP BY libraryItemId
      ORDER BY climaxCount DESC
      LIMIT ?
    `);
  }

  findAll(): ClimaxRecord[] {
    return this.findAllStmt.all() as ClimaxRecord[];
  }

  findById(id: number): ClimaxRecord | undefined {
    return this.findByIdStmt.get(id) as ClimaxRecord | undefined;
  }

  findBySessionId(sessionId: number): ClimaxRecord[] {
    return this.findBySessionIdStmt.all(sessionId) as ClimaxRecord[];
  }

  findByLibraryItemId(libraryItemId: number): ClimaxRecord[] {
    return this.findByLibraryItemIdStmt.all(libraryItemId) as ClimaxRecord[];
  }

  create(data: CreateClimaxRecordRequest): ClimaxRecord {
    return this.createStmt.get(
      data.sessionId ?? null,
      data.timestamp,
      data.runwayData,
      data.libraryItemId ?? null
    ) as ClimaxRecord;
  }

  delete(id: number): number {
    const result = this.deleteStmt.run(id);
    return result.changes;
  }

  getClimaxCountByScript(limit: number = 10): Array<{libraryItemId: number, climaxCount: number}> {
    return this.climaxCountByScriptStmt.all(limit) as Array<{libraryItemId: number, climaxCount: number}>;
  }
}
