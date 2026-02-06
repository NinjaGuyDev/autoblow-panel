import { z } from 'zod';

export const FunscriptActionSchema = z.object({
  pos: z.number().min(0).max(100),
  at: z.number().min(0),
});

export const FunscriptSchema = z.object({
  version: z.string(),
  inverted: z.boolean(),
  range: z.number().min(0).max(100),
  actions: z.array(FunscriptActionSchema).min(1, 'Funscript must have at least one action'),
}).passthrough();  // Allow unknown fields for forward compatibility

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
    const firstIssue = result.error.issues[0];
    throw new Error(`Invalid funscript: ${firstIssue.path.join('.')} - ${firstIssue.message}`);
  }
  return result.data;
}
