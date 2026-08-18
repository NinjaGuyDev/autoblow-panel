import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../db/schema.js';
import { seedBuiltInScriptMods } from '../db/built-in-script-mods.js';
import { ScriptModRepository } from '../repositories/script-mod.repository.js';
import { ScriptModService } from '../services/script-mod.service.js';
import { ScriptModDefinitionSchema } from '../schemas/script-mod.schemas.js';

describe('built-in script mods', () => {
  let db: Database.Database;
  let service: ScriptModService;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    seedBuiltInScriptMods(db);
    service = new ScriptModService(new ScriptModRepository(db));
  });

  it('seeds Hesitation and Blender on a fresh database', () => {
    const names = service.getAllMods().map(mod => mod.name).sort();
    expect(names).toEqual(['Blender', 'Hesitation']);
  });

  it('seeds definitions that satisfy the mod schema', () => {
    for (const mod of service.getAllMods()) {
      expect(() => ScriptModDefinitionSchema.parse(mod.definition)).not.toThrow();
    }
  });

  it('seeds Hesitation as a triggered burst and Blender as continuous', () => {
    const byName = new Map(service.getAllMods().map(mod => [mod.name, mod]));

    expect(byName.get('Hesitation')?.definition.kind).toBe('sequence-burst');
    expect(byName.get('Hesitation')?.definition.trigger).toEqual({
      type: 'random',
      minGapMs: 15_000,
    });
    expect(byName.get('Blender')?.definition.kind).toBe('continuous');
    expect(byName.get('Blender')?.definition.trigger).toBeNull();
  });

  it('does not duplicate mods when seeding runs again', () => {
    seedBuiltInScriptMods(db);
    seedBuiltInScriptMods(db);

    expect(service.getAllMods()).toHaveLength(2);
  });

  it('leaves a deleted built-in deleted across restarts', () => {
    const blender = service.getAllMods().find(mod => mod.name === 'Blender');
    service.deleteMod(blender!.id);

    seedBuiltInScriptMods(db);

    expect(service.getAllMods().map(mod => mod.name)).toEqual(['Hesitation']);
  });

  it('does not overwrite a built-in the user has edited', () => {
    const hesitation = service.getAllMods().find(mod => mod.name === 'Hesitation');
    service.updateMod(hesitation!.id, { name: 'My Hesitation' });

    seedBuiltInScriptMods(db);

    const names = service.getAllMods().map(mod => mod.name).sort();
    expect(names).toEqual(['Blender', 'My Hesitation']);
  });
});
