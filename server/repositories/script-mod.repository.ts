import type Database from 'better-sqlite3';

/** A `script_mods` row — `definition` is the mod definition as stored JSON. */
export interface ScriptModRow {
  id: number;
  name: string;
  description: string | null;
  definition: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptModWrite {
  name: string;
  description: string | null;
  definition: string;
}

export class ScriptModRepository {
  private readonly findAllStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly createStmt: Database.Statement;
  private readonly updateStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.findAllStmt = db.prepare(`
      SELECT * FROM script_mods ORDER BY updatedAt DESC
    `);

    this.findByIdStmt = db.prepare(`
      SELECT * FROM script_mods WHERE id = ?
    `);

    // Timestamps are written explicitly rather than left to the column
    // defaults: databases created before the defaults became ISO 8601 still
    // carry the old `datetime('now')` default, and mixing the two text formats
    // breaks `updatedAt DESC` ordering.
    this.createStmt = db.prepare(`
      INSERT INTO script_mods (name, description, definition, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    // `setsDescription` distinguishes an omitted description from an explicit
    // null, which COALESCE alone cannot express.
    this.updateStmt = db.prepare(`
      UPDATE script_mods
      SET name = COALESCE(?, name),
          description = CASE WHEN ? = 1 THEN ? ELSE description END,
          definition = COALESCE(?, definition),
          updatedAt = ?
      WHERE id = ?
      RETURNING *
    `);

    this.deleteStmt = db.prepare(`
      DELETE FROM script_mods WHERE id = ?
    `);
  }

  findAll(): ScriptModRow[] {
    return this.findAllStmt.all() as ScriptModRow[];
  }

  findById(id: number): ScriptModRow | undefined {
    return this.findByIdStmt.get(id) as ScriptModRow | undefined;
  }

  create(data: ScriptModWrite): ScriptModRow {
    const now = new Date().toISOString();
    return this.createStmt.get(
      data.name,
      data.description,
      data.definition,
      now,
      now,
    ) as ScriptModRow;
  }

  /**
   * Fields omitted from `data` keep their current value. `description` is the
   * one field a caller can clear, by supplying it explicitly as `null`.
   */
  update(id: number, data: Partial<ScriptModWrite>): ScriptModRow | undefined {
    const setsDescription = 'description' in data;
    return this.updateStmt.get(
      data.name ?? null,
      setsDescription ? 1 : 0,
      data.description ?? null,
      data.definition ?? null,
      new Date().toISOString(),
      id,
    ) as ScriptModRow | undefined;
  }

  delete(id: number): number {
    return this.deleteStmt.run(id).changes;
  }
}
