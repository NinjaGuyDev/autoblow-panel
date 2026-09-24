import type Database from 'better-sqlite3';

export class TrainerRankingRepository {
  private readonly createStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.createStmt = db.prepare(`
      INSERT INTO trainer_rankings (patternId, rank, createdAt)
      VALUES (?, ?, ?)
    `);
  }

  create(patternId: number, rank: number): void {
    this.createStmt.run(patternId, rank, new Date().toISOString());
  }
}
