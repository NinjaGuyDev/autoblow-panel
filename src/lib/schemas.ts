import { z } from 'zod';

export const FunscriptActionSchema = z.object({
  pos: z.number().min(0).max(100),
  at: z.number().min(0),
});

export const FunscriptMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  performers: z.array(z.string()).optional(),
  video_url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  duration: z.number().optional(),
  average_speed: z.number().optional(),
  creator: z.string().optional(),
}).passthrough();

// Original format: {version, inverted, range, actions}
export const OriginalFunscriptSchema = z.object({
  version: z.string(),
  inverted: z.boolean(),
  range: z.number().min(0).max(100),
  actions: z.array(FunscriptActionSchema).min(1, 'Funscript must have at least one action'),
}).passthrough();

// New format: {metadata, actions}
export const MetadataFunscriptSchema = z.object({
  metadata: FunscriptMetadataSchema,
  actions: z.array(FunscriptActionSchema).min(1, 'Funscript must have at least one action'),
}).passthrough();

// Union schema that accepts either format
export const FunscriptSchema = z.union([OriginalFunscriptSchema, MetadataFunscriptSchema]);

export type ZodFunscriptAction = z.infer<typeof FunscriptActionSchema>;
export type ZodFunscript = z.infer<typeof FunscriptSchema>;

export async function parseFunscriptFile(file: File): Promise<ZodFunscript> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  const result = FunscriptSchema.safeParse(json);
  if (!result.success) {
    // Provide user-friendly error message for common issues
    const issues = result.error.issues;
    const actionsIssue = issues.find(issue => issue.path.includes('actions'));
    if (actionsIssue) {
      throw new Error(`Invalid funscript: ${actionsIssue.message}`);
    }
    // Check if it's neither format (missing required fields)
    const hasVersion = 'version' in (json as Record<string, unknown>);
    const hasMetadata = 'metadata' in (json as Record<string, unknown>);
    const hasActions = 'actions' in (json as Record<string, unknown>);

    if (!hasActions) {
      throw new Error('Invalid funscript: missing "actions" array');
    }
    if (!hasVersion && !hasMetadata) {
      throw new Error('Invalid funscript: must have either "version" field (original format) or "metadata" field (new format)');
    }

    const firstIssue = issues[0];
    throw new Error(`Invalid funscript: ${firstIssue.path.join('.')} - ${firstIssue.message}`);
  }
  return result.data;
}
