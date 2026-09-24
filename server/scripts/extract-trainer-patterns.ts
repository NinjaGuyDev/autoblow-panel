/**
 * Extract trainer patterns from funscripts and store them in the app database.
 *
 *   npx tsx server/scripts/extract-trainer-patterns.ts [--dry-run] <file.funscript>...
 *
 * Honors DB_PATH like the server does. Re-running with the same files is safe:
 * samples already stored (same source file and start offset) are skipped.
 * A different set of files yields a different selection of samples, which is
 * added alongside the existing patterns.
 */

import { readFileSync } from 'fs';
import { basename } from 'path';
import type { FunscriptActionDto, NewTrainerPattern } from '../types/shared.js';
import { extractTrainerPatterns, type SourceScript } from '../lib/trainer/extract-trainer-patterns.js';

function isAction(value: unknown): value is FunscriptActionDto {
  return typeof value === 'object' && value !== null
    && typeof (value as FunscriptActionDto).at === 'number'
    && typeof (value as FunscriptActionDto).pos === 'number';
}

/** @throws Error when the file is not a funscript (an actions array, bare or wrapped). */
function readSource(path: string): SourceScript {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const actions = Array.isArray(parsed) ? parsed : (parsed as { actions?: unknown })?.actions;
  if (!Array.isArray(actions) || !actions.every(isAction)) {
    throw new Error(`${path} has no valid actions array`);
  }
  return { label: basename(path, '.funscript'), actions };
}

function printSummary(patterns: NewTrainerPattern[]): void {
  const families = new Set(patterns.map(p => p.familyKey));
  console.log(`${patterns.length} patterns in ${families.size} families`);
  for (const p of patterns) {
    console.log(`  ${p.name.padEnd(48)} ${(p.durationMs / 1000).toFixed(1)}s  ${p.intensity.padEnd(6)} ${p.sourceLabel}`);
  }
}

async function storePatterns(patterns: NewTrainerPattern[]): Promise<number> {
  // Imported lazily so --dry-run never opens (or creates) the database
  const { default: db } = await import('../db/connection.js');
  const { initializeSchema } = await import('../db/schema.js');
  const { TrainerPatternRepository } = await import('../repositories/trainer-pattern.repository.js');
  const { TrainerRankingRepository } = await import('../repositories/trainer-ranking.repository.js');
  const { TrainerService } = await import('../services/trainer.service.js');

  initializeSchema(db);
  const service = new TrainerService(new TrainerPatternRepository(db), new TrainerRankingRepository(db));
  return service.importPatterns(patterns);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const paths = args.filter(arg => arg !== '--dry-run');
  if (paths.length === 0) {
    console.error('Usage: npx tsx server/scripts/extract-trainer-patterns.ts [--dry-run] <file.funscript>...');
    process.exit(1);
  }

  const patterns = extractTrainerPatterns(paths.map(readSource));
  printSummary(patterns);

  if (!dryRun) {
    const inserted = await storePatterns(patterns);
    console.log(`Stored ${inserted} new patterns (${patterns.length - inserted} already present)`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
