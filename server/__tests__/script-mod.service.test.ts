import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../db/schema.js';
import { ScriptModRepository } from '../repositories/script-mod.repository.js';
import { ScriptModService } from '../services/script-mod.service.js';
import { NotFoundError, ValidationError } from '../errors/domain-errors.js';
import type { ScriptModDefinition } from '../types/shared.js';

const CONTINUOUS: ScriptModDefinition = {
  version: 1,
  kind: 'continuous',
  ops: [
    { op: 'randomSpeed', range: [0.75, 2.0], holdMs: { min: 5_000, max: 20_000 } },
    { op: 'pause', durationMs: { fixed: 2_000 }, minGapMs: 5_000, probabilityPerWindow: 0.5 },
  ],
  trigger: null,
};

describe('ScriptModService', () => {
  let service: ScriptModService;

  beforeEach(() => {
    const db = new Database(':memory:');
    initializeSchema(db);
    service = new ScriptModService(new ScriptModRepository(db));
  });

  it('round-trips a mod through storage', () => {
    const created = service.createMod({
      name: 'Chaos Mode',
      description: 'Random speed with pauses',
      definition: CONTINUOUS,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.definition).toEqual(CONTINUOUS);
    expect(service.getModById(created.id)).toEqual(created);
    expect(service.getAllMods()).toEqual([created]);
  });

  it('trims the name and rejects a blank one', () => {
    expect(service.createMod({ name: '  Edge  ', definition: CONTINUOUS }).name).toBe('Edge');
    expect(() => service.createMod({ name: '   ', definition: CONTINUOUS })).toThrow(ValidationError);
  });

  it('rejects a definition that breaks the schema', () => {
    const bad = { ...CONTINUOUS, ops: [{ op: 'speed', factor: 99, durationMs: { fixed: 1_000 } }] };

    expect(() => service.createMod({ name: 'Too fast', definition: bad as ScriptModDefinition }))
      .toThrow(ValidationError);
  });

  it('rejects a sequence-burst mod without a trigger', () => {
    const bad = { ...CONTINUOUS, kind: 'sequence-burst' as const };

    expect(() => service.createMod({ name: 'No trigger', definition: bad })).toThrow(ValidationError);
  });

  it('updates the name without touching the definition', () => {
    const created = service.createMod({ name: 'Original', definition: CONTINUOUS });
    const updated = service.updateMod(created.id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect(updated.definition).toEqual(CONTINUOUS);
  });

  it('deletes a mod', () => {
    const created = service.createMod({ name: 'Temp', definition: CONTINUOUS });
    service.deleteMod(created.id);

    expect(service.getAllMods()).toEqual([]);
    expect(() => service.getModById(created.id)).toThrow(NotFoundError);
  });

  it('reports missing mods as not found', () => {
    expect(() => service.getModById(4_242)).toThrow(NotFoundError);
    expect(() => service.updateMod(4_242, { name: 'x' })).toThrow(NotFoundError);
    expect(() => service.deleteMod(4_242)).toThrow(NotFoundError);
  });
});
