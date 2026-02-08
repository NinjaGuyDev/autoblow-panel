import type Database from 'better-sqlite3';
import type { LibraryItem, CreateLibraryItemRequest } from '../types/shared.js';

export class LibraryRepository {
  constructor(private db: Database.Database) {}

  findAll(): LibraryItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM library_items
      ORDER BY lastModified DESC
    `);
    return stmt.all() as LibraryItem[];
  }

  findById(id: number): LibraryItem | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM library_items WHERE id = ?
    `);
    return stmt.get(id) as LibraryItem | undefined;
  }

  search(query: string): LibraryItem[] {
    const searchPattern = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM library_items
      WHERE videoName LIKE ? OR funscriptName LIKE ?
      ORDER BY lastModified DESC
    `);
    return stmt.all(searchPattern, searchPattern) as LibraryItem[];
  }

  create(item: CreateLibraryItemRequest): LibraryItem {
    const lastModified = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO library_items (videoName, funscriptName, funscriptData, duration, lastModified)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      item.videoName,
      item.funscriptName,
      item.funscriptData,
      item.duration,
      lastModified
    ) as LibraryItem;
  }

  delete(id: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM library_items WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes;
  }

  upsertByVideoName(item: CreateLibraryItemRequest): LibraryItem {
    const lastModified = new Date().toISOString();

    // Check if item with matching videoName or funscriptName exists
    // Use IS instead of = for proper NULL comparison in SQL
    const existingStmt = this.db.prepare(`
      SELECT id FROM library_items
      WHERE (videoName IS ? AND videoName IS NOT NULL)
         OR (funscriptName IS ? AND funscriptName IS NOT NULL AND videoName IS NULL AND ? IS NULL)
      ORDER BY lastModified DESC
      LIMIT 1
    `);
    const existing = existingStmt.get(item.videoName, item.funscriptName, item.videoName) as { id: number } | undefined;

    if (existing) {
      // Update existing item
      const updateStmt = this.db.prepare(`
        UPDATE library_items
        SET funscriptName = ?, funscriptData = ?, duration = ?, lastModified = ?
        WHERE id = ?
        RETURNING *
      `);
      return updateStmt.get(
        item.funscriptName,
        item.funscriptData,
        item.duration,
        lastModified,
        existing.id
      ) as LibraryItem;
    } else {
      // Create new item
      return this.create(item);
    }
  }

  getMigrationStatus(): boolean {
    const stmt = this.db.prepare(`
      SELECT migrated FROM migration_status WHERE id = 1
    `);
    const result = stmt.get() as { migrated: number } | undefined;
    return result?.migrated === 1;
  }

  setMigrationComplete(): void {
    const stmt = this.db.prepare(`
      UPDATE migration_status
      SET migrated = 1, migratedAt = datetime('now')
      WHERE id = 1
    `);
    stmt.run();
  }

  bulkCreate(items: CreateLibraryItemRequest[]): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO library_items (videoName, funscriptName, funscriptData, duration, lastModified)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: CreateLibraryItemRequest[]) => {
      const lastModified = new Date().toISOString();
      for (const item of items) {
        insertStmt.run(
          item.videoName,
          item.funscriptName,
          item.funscriptData,
          item.duration,
          lastModified
        );
      }
    });

    insertMany(items);
  }
}
