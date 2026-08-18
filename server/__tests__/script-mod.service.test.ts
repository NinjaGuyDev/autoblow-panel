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

  it('keeps the stored description when the update omits it', () => {
    const created = service.createMod({ name: 'Chaos', description: 'loud', definition: CONTINUOUS });

    expect(service.updateMod(created.id, { name: 'Calm' }).description).toBe('loud');
  });

  it('clears the description when the update supplies null', () => {
    const created = service.createMod({ name: 'Chaos', description: 'loud', definition: CONTINUOUS });

    expect(service.updateMod(created.id, { description: null }).description).toBeNull();
    expect(service.getModById(created.id).description).toBeNull();
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

describe('script_mods timestamps', () => {
  const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  it('writes created and updated timestamps in the same ISO 8601 format', () => {
    const db = new Database(':memory:');
    initializeSchema(db);
    const service = new ScriptModService(new ScriptModRepository(db));

    const created = service.createMod({ name: 'Fresh', definition: CONTINUOUS });
    const updated = service.updateMod(created.id, { name: 'Fresher' });

    expect(created.createdAt).toMatch(ISO_8601);
    expect(created.updatedAt).toMatch(ISO_8601);
    expect(updated.updatedAt).toMatch(ISO_8601);
  });

  it('normalizes legacy datetime() rows so updatedAt DESC stays chronological', () => {
    const db = new Database(':memory:');
    initializeSchema(db);

    // A row left by an older build alongside one written in ISO 8601. Sorted as
    // raw text the ISO row wins on "T" > " " despite being four hours older.
    db.prepare(`
      INSERT INTO script_mods (name, description, definition, createdAt, updatedAt)
      VALUES (?, NULL, ?, ?, ?)
    `).run('Legacy', JSON.stringify(CONTINUOUS), '2026-01-01 12:00:00', '2026-01-01 12:00:00');
    db.prepare(`
      INSERT INTO script_mods (name, description, definition, createdAt, updatedAt)
      VALUES (?, NULL, ?, ?, ?)
    `).run('Modern', JSON.stringify(CONTINUOUS), '2026-01-01T08:00:00.000Z', '2026-01-01T08:00:00.000Z');

    // Restarting the server re-runs the schema, which carries the migration
    initializeSchema(db);
    const mods = new ScriptModService(new ScriptModRepository(db)).getAllMods();

    expect(mods.map(mod => mod.name)).toEqual(['Legacy', 'Modern']);
    expect(mods[0]!.updatedAt).toBe('2026-01-01T12:00:00.000Z');
    expect(mods[0]!.createdAt).toBe('2026-01-01T12:00:00.000Z');
  });
});
