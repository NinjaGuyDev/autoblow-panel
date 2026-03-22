import { z } from 'zod';

export const CreateClimaxRecordSchema = z.object({
  sessionId: z.number().int().positive().nullable().optional(),
  timestamp: z.string(),
  runwayData: z.string(),
  libraryItemId: z.number().int().positive().nullable().optional(),
});

export const CreatePauseEventSchema = z.object({
  sessionId: z.number().int().positive(),
  timestamp: z.string(),
});

export const ResumePauseEventSchema = z.object({
  resumedAt: z.string().min(1).optional(),
});
