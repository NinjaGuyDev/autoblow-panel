import type {
  CreateScriptModRequest,
  ScriptMod,
  ScriptModDefinition,
  UpdateScriptModRequest,
} from '../types/shared.js';
import type { ScriptModRepository, ScriptModRow } from '../repositories/script-mod.repository.js';
import { ScriptModDefinitionSchema } from '../schemas/script-mod.schemas.js';
import { NotFoundError, ValidationError } from '../errors/domain-errors.js';

export class ScriptModService {
  constructor(private repository: ScriptModRepository) {}

  /** @throws Error when a stored definition can no longer be parsed. */
  getAllMods(): ScriptMod[] {
    return this.repository.findAll().map(row => this.toMod(row));
  }

  /** @throws NotFoundError when no mod has that id. */
  getModById(id: number): ScriptMod {
    const row = this.repository.findById(id);
    if (!row) {
      throw new NotFoundError(`Script mod with id ${id} not found`);
    }
    return this.toMod(row);
  }

  /** @throws ValidationError when the name is blank or the definition is invalid. */
  createMod(data: CreateScriptModRequest): ScriptMod {
    const name = data.name.trim();
    if (name === '') {
      throw new ValidationError('Script mod name cannot be empty');
    }

    return this.toMod(this.repository.create({
      name,
      description: data.description ?? null,
      definition: JSON.stringify(this.validateDefinition(data.definition)),
    }));
  }

  /**
   * @throws ValidationError when the name is blank or the definition is invalid.
   * @throws NotFoundError when no mod has that id.
   */
  updateMod(id: number, data: UpdateScriptModRequest): ScriptMod {
    const name = data.name?.trim();
    if (name !== undefined && name === '') {
      throw new ValidationError('Script mod name cannot be empty');
    }

    const updated = this.repository.update(id, {
      name,
      // Forwarded only when the caller supplied it: an omitted description
      // keeps the stored value, an explicit null clears it.
      ...(data.description !== undefined ? { description: data.description } : {}),
      definition: data.definition
        ? JSON.stringify(this.validateDefinition(data.definition))
        : undefined,
    });

    if (!updated) {
      throw new NotFoundError(`Script mod with id ${id} not found`);
    }
    return this.toMod(updated);
  }

  /** @throws NotFoundError when no mod has that id. */
  deleteMod(id: number): void {
    if (this.repository.delete(id) === 0) {
      throw new NotFoundError(`Script mod with id ${id} not found`);
    }
  }

  /** @throws ValidationError when the definition fails schema validation. */
  validateDefinition(definition: unknown): ScriptModDefinition {
    const result = ScriptModDefinitionSchema.safeParse(definition);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join('.') ?? '';
      throw new ValidationError(
        path ? `definition.${path}: ${issue?.message}` : `Invalid mod definition: ${issue?.message}`,
      );
    }
    return result.data;
  }

  private toMod(row: ScriptModRow): ScriptMod {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.definition);
    } catch {
      throw new Error(`Script mod ${row.id} has a corrupt definition`);
    }

    const result = ScriptModDefinitionSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Script mod ${row.id} has an unsupported definition`);
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      definition: result.data,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
