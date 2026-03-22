import { z } from 'zod';

export const CreateLibraryItemSchema = z.object({
  videoName: z.string().nullable(),
  funscriptName: z.string().nullable(),
  funscriptData: z.string(),
  duration: z.number().nullable(),
  isCustomPattern: z.number().optional(),
  originalPatternId: z.string().nullable().optional(),
  patternMetadata: z.string().nullable().optional(),
});

export const UpdateLibraryItemSchema = z.object({
  funscriptName: z.string().nullable().optional(),
  funscriptData: z.string().optional(),
  duration: z.number().nullable().optional(),
});

export const MigrationSchema = z.object({
  data: z.array(CreateLibraryItemSchema),
});
