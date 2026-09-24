import type Database from 'better-sqlite3';

/**
 * A `trainer_patterns` row joined with its ranking statistics.
 * `actions` and `tags` are stored JSON.
 */
export interface TrainerPatternRow {
  id: number;
  patternKey: string;
  name: string;
  sourceLabel: string;
  familyKey: string;
  variation: number;
  actions: string;
  durationMs: number;
  intensity: string;
  tags: string;
  createdAt: string;
  averageRank: number | null;
  rankCount: number;
}

export type TrainerPatternWrite = Omit<TrainerPatternRow, 'id' | 'createdAt' | 'averageRank' | 'rankCount'>;

const SELECT_WITH_STATS = `
  SELECT p.*, AVG(r.rank) AS averageRank, COUNT(r.id) AS rankCount
  FROM trainer_patterns p
  LEFT JOIN trainer_rankings r ON r.patternId = p.id
`;

export class TrainerPatternRepository {
  private readonly findAllStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly insertIgnoringDuplicatesStmt: Database.Statement;
  private readonly insertMany: (rows: TrainerPatternWrite[]) => number;

  constructor(db: Database.Database) {
    this.findAllStmt = db.prepare(`
      ${SELECT_WITH_STATS}
      GROUP BY p.id
      ORDER BY p.familyKey, p.variation
    `);

    this.findByIdStmt = db.prepare(`
      ${SELECT_WITH_STATS}
      WHERE p.id = ?
      GROUP BY p.id
    `);

    this.insertIgnoringDuplicatesStmt = db.prepare(`
      INSERT OR IGNORE INTO trainer_patterns
        (patternKey, name, sourceLabel, familyKey, variation, actions, durationMs, intensity, tags, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertMany = db.transaction((rows: TrainerPatternWrite[]) => {
      const createdAt = new Date().toISOString();
      let inserted = 0;
      for (const row of rows) {
        inserted += this.insertIgnoringDuplicatesStmt.run(
          row.patternKey,
          row.name,
          row.sourceLabel,
          row.familyKey,
          row.variation,
          row.actions,
          row.durationMs,
          row.intensity,
          row.tags,
          createdAt,
        ).changes;
      }
      return inserted;
    });
  }

  findAll(): TrainerPatternRow[] {
    return this.findAllStmt.all() as TrainerPatternRow[];
  }

  findById(id: number): TrainerPatternRow | undefined {
    return this.findByIdStmt.get(id) as TrainerPatternRow | undefined;
  }

  /** Inserts in one transaction; rows whose patternKey already exists are skipped. Returns the insert count. */
  insertAll(rows: TrainerPatternWrite[]): number {
    return this.insertMany(rows);
  }
}
