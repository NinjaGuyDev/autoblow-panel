import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../db/schema.js';
import { TrainerPatternRepository } from '../repositories/trainer-pattern.repository.js';
import { TrainerRankingRepository } from '../repositories/trainer-ranking.repository.js';
import { TrainerService } from '../services/trainer.service.js';
import { NotFoundError, ValidationError } from '../errors/domain-errors.js';
import type { NewTrainerPattern } from '../types/shared.js';

function pattern(key: string, variation = 1): NewTrainerPattern {
  return {
    patternKey: key,
    name: `Slow Long Strokes, Mid A${variation}`,
    sourceLabel: 'source',
    familyKey: 'A',
    variation,
    actions: [{ at: 0, pos: 0 }, { at: 1_000, pos: 100 }],
    durationMs: 1_000,
    intensity: 'medium',
    tags: ['rhythmic'],
  };
}

describe('TrainerService', () => {
  let service: TrainerService;

  beforeEach(() => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    service = new TrainerService(new TrainerPatternRepository(db), new TrainerRankingRepository(db));
  });

  it('imports patterns once, skipping keys already stored', () => {
    expect(service.importPatterns([pattern('a@0'), pattern('a@10', 2)])).toBe(2);
    expect(service.importPatterns([pattern('a@0'), pattern('b@0')])).toBe(1);

    const stored = service.getAllPatterns();
    expect(stored).toHaveLength(3);
    expect(stored[0]).toMatchObject({
      patternKey: 'a@0',
      actions: [{ at: 0, pos: 0 }, { at: 1_000, pos: 100 }],
      tags: ['rhythmic'],
      averageRank: null,
      rankCount: 0,
    });
  });

  it('averages every rank a pattern receives', () => {
    service.importPatterns([pattern('a@0')]);
    const id = service.getAllPatterns()[0]!.id;

    service.rankPattern(id, 9);
    service.rankPattern(id, 4);
    const ranked = service.rankPattern(id, 2);

    expect(ranked.rankCount).toBe(3);
    expect(ranked.averageRank).toBe(5);
  });

  it('rejects ranks outside 0-9 and unknown patterns', () => {
    service.importPatterns([pattern('a@0')]);
    const id = service.getAllPatterns()[0]!.id;

    expect(() => service.rankPattern(id, 10)).toThrow(ValidationError);
    expect(() => service.rankPattern(id, 2.5)).toThrow(ValidationError);
    expect(() => service.rankPattern(999, 5)).toThrow(NotFoundError);
    expect(service.rankPattern(id, 0).averageRank).toBe(0);
  });

  it('rejects patterns with no motion to play', () => {
    expect(() => service.importPatterns([{ ...pattern('a@0'), actions: [{ at: 0, pos: 0 }] }]))
      .toThrow(ValidationError);
  });
});
