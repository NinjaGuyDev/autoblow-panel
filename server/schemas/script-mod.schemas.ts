import { z } from 'zod';

/** Matches MIN_SPEED_FACTOR / MAX_SPEED_FACTOR in src/lib/timeWarp.ts. */
const MIN_SPEED_FACTOR = 0.1;
const MAX_SPEED_FACTOR = 4.0;

const FactorSchema = z.number().min(MIN_SPEED_FACTOR).max(MAX_SPEED_FACTOR);

const PositiveMs = z.number().int().positive();

const ModDurationSpecSchema = z
  .object({
    fixed: PositiveMs.nullish(),
    min: PositiveMs.nullish(),
    max: PositiveMs.nullish(),
  })
  .refine(
    spec => spec.fixed != null || (spec.min != null && spec.max != null),
    { message: 'must supply either `fixed` or both `min` and `max`' },
  )
  .refine(
    spec => spec.min == null || spec.max == null || spec.min <= spec.max,
    { message: '`min` must be less than or equal to `max`' },
  );

const ModSpeedOpSchema = z.object({
  op: z.literal('speed'),
  factor: FactorSchema,
  durationMs: ModDurationSpecSchema,
});

const ModRandomSpeedOpSchema = z.object({
  op: z.literal('randomSpeed'),
  range: z.tuple([FactorSchema, FactorSchema]).refine(
    ([low, high]) => low <= high,
    { message: 'range must be ordered [min, max]' },
  ),
  holdMs: ModDurationSpecSchema,
});

const ModPauseOpSchema = z.object({
  op: z.literal('pause'),
  durationMs: ModDurationSpecSchema,
  minGapMs: PositiveMs,
  probabilityPerWindow: z.number().min(0).max(1),
});

const ScriptModOpSchema = z.discriminatedUnion('op', [
  ModSpeedOpSchema,
  ModRandomSpeedOpSchema,
  ModPauseOpSchema,
]);

const ScriptModTriggerSchema = z.object({
  type: z.literal('random'),
  minGapMs: PositiveMs,
});

export const ScriptModDefinitionSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum(['sequence-burst', 'continuous']),
    ops: z.array(ScriptModOpSchema).min(1),
    trigger: ScriptModTriggerSchema.nullish(),
  })
  .refine(
    definition => definition.kind !== 'sequence-burst' || definition.trigger != null,
    { message: 'sequence-burst mods require a trigger' },
  )
  .refine(
    definition => definition.kind !== 'continuous'
      || definition.ops.some(op => op.op === 'speed' || op.op === 'randomSpeed'),
    { message: 'continuous mods require at least one speed or randomSpeed op' },
  );

export const CreateScriptModSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  definition: ScriptModDefinitionSchema,
});

export const UpdateScriptModSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    definition: ScriptModDefinitionSchema.optional(),
  })
  .refine(
    body => Object.keys(body).length > 0,
    { message: 'at least one field must be supplied' },
  );

export const GenerateScriptModSchema = z.object({
  instruction: z.string().trim().min(1).max(2_000),
  scriptDurationMs: z.number().int().positive().nullable().optional(),
});

/**
 * JSON schema handed to Claude for structured output.
 *
 * Structured-output schemas do not support `minimum`/`maximum`/`minLength`, so
 * this stays purely structural — numeric ranges are enforced by
 * `ScriptModDefinitionSchema` after the response is parsed.
 */
const NULLABLE_INTEGER = { anyOf: [{ type: 'integer' }, { type: 'null' }] } as const;

const DURATION_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fixed', 'min', 'max'],
  properties: {
    fixed: { ...NULLABLE_INTEGER, description: 'Exact duration in ms, or null when a range is used' },
    min: { ...NULLABLE_INTEGER, description: 'Lower bound in ms, or null when fixed is used' },
    max: { ...NULLABLE_INTEGER, description: 'Upper bound in ms, or null when fixed is used' },
  },
} as const;

export const GENERATE_SCRIPT_MOD_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['definition', 'notes'],
  properties: {
    notes: {
      type: 'string',
      description: 'One or two sentences explaining how the mod realises the instruction.',
    },
    definition: {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'kind', 'ops', 'trigger'],
      properties: {
        version: { type: 'integer', description: 'Always 1' },
        kind: { type: 'string', enum: ['sequence-burst', 'continuous'] },
        trigger: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'minGapMs'],
              properties: {
                type: { type: 'string', enum: ['random'] },
                minGapMs: { type: 'integer' },
              },
            },
            { type: 'null' },
          ],
          description: 'Required for sequence-burst mods, null for continuous mods',
        },
        ops: {
          type: 'array',
          items: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['op', 'factor', 'durationMs'],
                properties: {
                  op: { type: 'string', enum: ['speed'] },
                  factor: { type: 'number' },
                  durationMs: DURATION_SPEC_SCHEMA,
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['op', 'range', 'holdMs'],
                properties: {
                  op: { type: 'string', enum: ['randomSpeed'] },
                  range: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'Exactly two entries, [min, max]',
                  },
                  holdMs: DURATION_SPEC_SCHEMA,
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['op', 'durationMs', 'minGapMs', 'probabilityPerWindow'],
                properties: {
                  op: { type: 'string', enum: ['pause'] },
                  durationMs: DURATION_SPEC_SCHEMA,
                  minGapMs: { type: 'integer' },
                  probabilityPerWindow: { type: 'number' },
                },
              },
            ],
          },
        },
      },
    },
  },
};
