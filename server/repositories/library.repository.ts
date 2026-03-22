import type Database from 'better-sqlite3';
import type { LibraryItem, CreateLibraryItemRequest } from '../types/shared.js';

export class LibraryRepository {
  private readonly findAllStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly searchStmt: Database.Statement;
  private readonly findCustomPatternsStmt: Database.Statement;
  private readonly createStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly softDeleteStmt: Database.Statement;
  private readonly updateByIdStmt: Database.Statement;
  private readonly updateCustomPatternStmt: Database.Statement;
  private readonly findExistingByNameStmt: Database.Statement;
  private readonly upsertUpdateStmt: Database.Statement;
  private readonly getMigrationStatusStmt: Database.Statement;
  private readonly setMigrationCompleteStmt: Database.Statement;
  private readonly bulkInsertStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.findAllStmt = db.prepare(`
      SELECT * FROM library_items
      WHERE (isCustomPattern = 0 OR isCustomPattern IS NULL)
        AND deletedAt IS NULL
      ORDER BY lastModified DESC
    `);

    this.findByIdStmt = db.prepare(`
      SELECT * FROM library_items WHERE id = ?
    `);

    this.searchStmt = db.prepare(`
      SELECT * FROM library_items
      WHERE (videoName LIKE ? OR funscriptName LIKE ?)
        AND (isCustomPattern = 0 OR isCustomPattern IS NULL)
        AND deletedAt IS NULL
      ORDER BY lastModified DESC
    `);

    this.findCustomPatternsStmt = db.prepare(`
      SELECT * FROM library_items
      WHERE isCustomPattern = 1
        AND deletedAt IS NULL
      ORDER BY lastModified DESC
    `);

    this.createStmt = db.prepare(`
      INSERT INTO library_items (videoName, funscriptName, funscriptData, duration, lastModified, isCustomPattern, originalPatternId, patternMetadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    this.deleteStmt = db.prepare(`
      DELETE FROM library_items WHERE id = ?
    `);

    this.softDeleteStmt = db.prepare(`
      UPDATE library_items
      SET deletedAt = ?
      WHERE id = ? AND deletedAt IS NULL
    `);

    this.updateByIdStmt = db.prepare(`
      UPDATE library_items
      SET funscriptName = COALESCE(?, funscriptName),
          funscriptData = COALESCE(?, funscriptData),
          duration = COALESCE(?, duration),
          lastModified = ?
      WHERE id = ?
      RETURNING *
    `);

    this.updateCustomPatternStmt = db.prepare(`
      UPDATE library_items
      SET funscriptData = COALESCE(?, funscriptData),
          patternMetadata = COALESCE(?, patternMetadata),
          lastModified = ?
      WHERE id = ?
      RETURNING *
    `);

    this.findExistingByNameStmt = db.prepare(`
      SELECT id FROM library_items
      WHERE (videoName IS ? AND videoName IS NOT NULL)
         OR (funscriptName IS ? AND funscriptName IS NOT NULL AND videoName IS NULL AND ? IS NULL)
      ORDER BY lastModified DESC
      LIMIT 1
    `);

    this.upsertUpdateStmt = db.prepare(`
      UPDATE library_items
      SET funscriptName = ?, funscriptData = ?, duration = ?, lastModified = ?
      WHERE id = ?
      RETURNING *
    `);

    this.getMigrationStatusStmt = db.prepare(`
      SELECT migrated FROM migration_status WHERE id = 1
    `);

    this.setMigrationCompleteStmt = db.prepare(`
      UPDATE migration_status
      SET migrated = 1, migratedAt = ?
      WHERE id = 1
    `);

    this.bulkInsertStmt = db.prepare(`
      INSERT INTO library_items (videoName, funscriptName, funscriptData, duration, lastModified, isCustomPattern, originalPatternId, patternMetadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  findAll(): LibraryItem[] {
    return this.findAllStmt.all() as LibraryItem[];
  }

  findById(id: number): LibraryItem | undefined {
    return this.findByIdStmt.get(id) as LibraryItem | undefined;
  }

  search(query: string): LibraryItem[] {
    const searchPattern = `%${query}%`;
    return this.searchStmt.all(searchPattern, searchPattern) as LibraryItem[];
  }

  findCustomPatterns(): LibraryItem[] {
    return this.findCustomPatternsStmt.all() as LibraryItem[];
  }

  create(item: CreateLibraryItemRequest): LibraryItem {
    const lastModified = new Date().toISOString();
    return this.createStmt.get(
      item.videoName,
      item.funscriptName,
      item.funscriptData,
      item.duration,
      lastModified,
      item.isCustomPattern ?? 0,
      item.originalPatternId ?? null,
      item.patternMetadata ?? null
    ) as LibraryItem;
  }

  delete(id: number): number {
    const result = this.deleteStmt.run(id);
    return result.changes;
  }

  softDelete(id: number): number {
    const deletedAt = new Date().toISOString();
    const result = this.softDeleteStmt.run(deletedAt, id);
    return result.changes;
  }

  updateById(id: number, item: Partial<CreateLibraryItemRequest>): LibraryItem {
    const lastModified = new Date().toISOString();
    return this.updateByIdStmt.get(
      item.funscriptName ?? null,
      item.funscriptData ?? null,
      item.duration ?? null,
      lastModified,
      id
    ) as LibraryItem;
  }

  updateCustomPattern(id: number, item: Partial<CreateLibraryItemRequest>): LibraryItem {
    const lastModified = new Date().toISOString();
    return this.updateCustomPatternStmt.get(
      item.funscriptData ?? null,
      item.patternMetadata ?? null,
      lastModified,
      id
    ) as LibraryItem;
  }

  upsertByVideoName(item: CreateLibraryItemRequest): LibraryItem {
    const lastModified = new Date().toISOString();

    const existing = this.findExistingByNameStmt.get(
      item.videoName,
      item.funscriptName,
      item.videoName
    ) as { id: number } | undefined;

    if (existing) {
      return this.upsertUpdateStmt.get(
        item.funscriptName,
        item.funscriptData,
        item.duration,
        lastModified,
        existing.id
      ) as LibraryItem;
    } else {
      return this.create(item);
    }
  }

  getMigrationStatus(): boolean {
    const result = this.getMigrationStatusStmt.get() as { migrated: number } | undefined;
    return result?.migrated === 1;
  }

  setMigrationComplete(): void {
    const migratedAt = new Date().toISOString();
    this.setMigrationCompleteStmt.run(migratedAt);
  }

  bulkCreate(items: CreateLibraryItemRequest[]): void {
    const insertMany = this.db.transaction((items: CreateLibraryItemRequest[]) => {
      const lastModified = new Date().toISOString();
      for (const item of items) {
        this.bulkInsertStmt.run(
          item.videoName,
          item.funscriptName,
          item.funscriptData,
          item.duration,
          lastModified,
          item.isCustomPattern ?? 0,
          item.originalPatternId ?? null,
          item.patternMetadata ?? null
        );
      }
    });

    insertMany(items);
  }
}
