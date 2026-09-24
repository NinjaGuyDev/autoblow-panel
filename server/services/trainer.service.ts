import {
  TRAINER_RANK_MAX,
  TRAINER_RANK_MIN,
  type NewTrainerPattern,
  type TrainerIntensity,
  type TrainerPattern,
} from '../types/shared.js';
import type { TrainerPatternRow, TrainerPatternWrite } from '../repositories/trainer-pattern.repository.js';
import { NotFoundError, ValidationError } from '../errors/domain-errors.js';

/** Storage the trainer needs for patterns — implemented by TrainerPatternRepository. */
export interface TrainerPatternStore {
  findAll(): TrainerPatternRow[];
  findById(id: number): TrainerPatternRow | undefined;
  insertAll(rows: TrainerPatternWrite[]): number;
}

/** Storage the trainer needs for rankings — implemented by TrainerRankingRepository. */
export interface TrainerRankingStore {
  create(patternId: number, rank: number): void;
}

const INTENSITIES: ReadonlySet<string> = new Set<TrainerIntensity>(['low', 'medium', 'high']);

export class TrainerService {
  constructor(
    private patterns: TrainerPatternStore,
    private rankings: TrainerRankingStore,
  ) {}

  /** @throws Error when a stored pattern's JSON can no longer be parsed. */
  getAllPatterns(): TrainerPattern[] {
    return this.patterns.findAll().map(row => this.toPattern(row));
  }

  /**
   * Record one rank for a pattern and return the pattern with refreshed stats.
   * @throws ValidationError when the rank is not an integer from 0 to 9.
   * @throws NotFoundError when no pattern has that id.
   */
  rankPattern(patternId: number, rank: number): TrainerPattern {
    if (!Number.isInteger(rank) || rank < TRAINER_RANK_MIN || rank > TRAINER_RANK_MAX) {
      throw new ValidationError(`Rank must be an integer from ${TRAINER_RANK_MIN} to ${TRAINER_RANK_MAX}`);
    }
    this.requirePattern(patternId);
    this.rankings.create(patternId, rank);
    return this.toPattern(this.requirePattern(patternId));
  }

  /**
   * Store extracted patterns, skipping any whose patternKey is already stored.
   * Returns how many were inserted.
   * @throws ValidationError when a pattern has an unknown intensity or no actions.
   */
  importPatterns(patterns: NewTrainerPattern[]): number {
    return this.patterns.insertAll(patterns.map(pattern => this.toWrite(pattern)));
  }

  private requirePattern(id: number): TrainerPatternRow {
    const row = this.patterns.findById(id);
    if (!row) {
      throw new NotFoundError(`Trainer pattern with id ${id} not found`);
    }
    return row;
  }

  private toWrite(pattern: NewTrainerPattern): TrainerPatternWrite {
    if (!INTENSITIES.has(pattern.intensity)) {
      throw new ValidationError(`Unknown intensity "${pattern.intensity}" on ${pattern.patternKey}`);
    }
    if (pattern.actions.length < 2) {
      throw new ValidationError(`Pattern ${pattern.patternKey} needs at least two actions`);
    }
    return {
      ...pattern,
      actions: JSON.stringify(pattern.actions),
      tags: JSON.stringify(pattern.tags),
    };
  }

  private toPattern(row: TrainerPatternRow): TrainerPattern {
    return {
      ...row,
      actions: JSON.parse(row.actions),
      tags: JSON.parse(row.tags),
      intensity: row.intensity as TrainerIntensity,
    };
  }
}
