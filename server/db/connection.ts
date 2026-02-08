import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DB_PATH || './data/autoblow.db';

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

// Create SQLite database connection
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Set busy timeout to 5 seconds
db.pragma('busy_timeout = 5000');

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

export default db;
