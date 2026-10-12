import { z } from 'zod';

export const TrimToFunscriptSchema = z.object({
  videoName: z.string().min(1),
  funscriptName: z.string().nullable(),
  funscriptData: z.string().min(1),
});

/**
 * A funscript document as far as trimming cares: its actions are checked, and
 * every other field (metadata, editor state) is carried through untouched.
 */
export const FunscriptDocumentSchema = z.looseObject({
  actions: z.array(z.looseObject({ at: z.number().nonnegative(), pos: z.number() })).min(1),
  metadata: z.looseObject({ duration: z.number().optional() }).optional(),
});

export type FunscriptDocument = z.infer<typeof FunscriptDocumentSchema>;
