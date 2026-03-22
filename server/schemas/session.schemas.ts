import { z } from 'zod';

export const CreateSessionSchema = z.object({
  startedAt: z.string(),
  libraryItemId: z.number().int().positive().nullable().optional(),
  context: z.string(),
  scriptOrder: z.string().optional(),
});

export const UpdateSessionSchema = z.object({
  endedAt: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  scriptOrder: z.string().nullable().optional(),
});

export const AppendScriptSchema = z.object({
  libraryItemId: z.number().int().positive(),
  timestamp: z.string(),
});

export const EndSessionSchema = z.object({
  endedAt: z.string().optional(),
});
