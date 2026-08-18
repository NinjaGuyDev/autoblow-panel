import type Database from 'better-sqlite3';
import type { ScriptModDefinition } from '../types/shared.js';

interface BuiltInScriptMod {
  name: string;
  description: string;
  definition: ScriptModDefinition;
}

/**
 * Mods shipped with the app so the Mods panel is useful before the user has
 * authored anything. These mirror the two worked examples from the Live Speed
 * Control & Script Mods feature plan.
 */
const BUILT_IN_SCRIPT_MODS: readonly BuiltInScriptMod[] = [
  {
    name: 'Hesitation',
    description:
      "Randomly bursts to 2x speed for 4-10 seconds, then drops to 75% speed for 8 seconds before returning to the script's original speed.",
    definition: {
      version: 1,
      kind: 'sequence-burst',
      ops: [
        { op: 'speed', factor: 2.0, durationMs: { min: 4_000, max: 10_000 } },
        { op: 'speed', factor: 0.75, durationMs: { fixed: 8_000 } },
      ],
      trigger: { type: 'random', minGapMs: 15_000 },
    },
  },
  {
    name: 'Blender',
    description:
      'Continuously varies speed between 75% and 2x every 5-20 seconds, with 2-second pauses at random intervals no closer than 5 seconds apart.',
    definition: {
      version: 1,
      kind: 'continuous',
      ops: [
        { op: 'randomSpeed', range: [0.75, 2.0], holdMs: { min: 5_000, max: 20_000 } },
        { op: 'pause', durationMs: { fixed: 2_000 }, minGapMs: 5_000, probabilityPerWindow: 0.5 },
      ],
      trigger: null,
    },
  },
];

/**
 * Inserts the built-in mods once per database.
 *
 * Seeding is tracked by name in `script_mod_seeds` rather than by probing
 * `script_mods`, so a built-in the user deleted or renamed stays gone instead of
 * reappearing on the next server start.
 */
export function seedBuiltInScriptMods(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS script_mod_seeds (
      name TEXT PRIMARY KEY,
      seededAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const alreadySeeded = db.prepare('SELECT 1 FROM script_mod_seeds WHERE name = ?');
  const insertMod = db.prepare(
    'INSERT INTO script_mods (name, description, definition) VALUES (?, ?, ?)'
  );
  const markSeeded = db.prepare('INSERT INTO script_mod_seeds (name) VALUES (?)');

  const seedAll = db.transaction((mods: readonly BuiltInScriptMod[]) => {
    for (const mod of mods) {
      if (alreadySeeded.get(mod.name)) continue;
      insertMod.run(mod.name, mod.description, JSON.stringify(mod.definition));
      markSeeded.run(mod.name);
    }
  });

  seedAll(BUILT_IN_SCRIPT_MODS);
}
