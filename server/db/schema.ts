import type Database from 'better-sqlite3';

export function initializeSchema(db: Database.Database): void {
  // Create library_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS library_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      videoName TEXT,
      funscriptName TEXT,
      funscriptData TEXT NOT NULL,
      duration REAL,
      lastModified TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_library_video_name ON library_items(videoName);
    CREATE INDEX IF NOT EXISTS idx_library_funscript_name ON library_items(funscriptName);
    CREATE INDEX IF NOT EXISTS idx_library_last_modified ON library_items(lastModified DESC);
  `);

  // Create migration_status table to track IndexedDB migration
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      migrated INTEGER NOT NULL DEFAULT 0,
      migratedAt TEXT
    );
  `);

  // Initialize migration status if not exists
  db.exec(`
    INSERT OR IGNORE INTO migration_status (id, migrated) VALUES (1, 0);
  `);

  // Idempotent schema migrations for custom pattern support
  const tableInfo = db.prepare('PRAGMA table_info(library_items)').all() as Array<{ name: string }>;
  const existingColumns = new Set(tableInfo.map(col => col.name));

  if (!existingColumns.has('isCustomPattern')) {
    db.exec(`
      ALTER TABLE library_items
      ADD COLUMN isCustomPattern INTEGER DEFAULT 0;
    `);
  }

  if (!existingColumns.has('originalPatternId')) {
    db.exec(`
      ALTER TABLE library_items
      ADD COLUMN originalPatternId TEXT;
    `);
  }

  if (!existingColumns.has('patternMetadata')) {
    db.exec(`
      ALTER TABLE library_items
      ADD COLUMN patternMetadata TEXT;
    `);
  }

  // Create index on isCustomPattern for efficient filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_library_custom_pattern ON library_items(isCustomPattern);
  `);
}
