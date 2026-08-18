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

    this.createStmt = db.prepare(`
      INSERT INTO script_mods (name, description, definition)
      VALUES (?, ?, ?)
      RETURNING *
    `);

    this.updateStmt = db.prepare(`
      UPDATE script_mods
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
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
    return this.createStmt.get(data.name, data.description, data.definition) as ScriptModRow;
  }

  /** Fields left `null` keep their current value. */
  update(id: number, data: Partial<ScriptModWrite>): ScriptModRow | undefined {
    return this.updateStmt.get(
      data.name ?? null,
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
