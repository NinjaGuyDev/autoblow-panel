import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const path = firstIssue.path.join('.');
      const message = path
        ? `${path}: ${firstIssue.message}`
        : firstIssue.message;
      res.status(400).json({ error: message });
      return;
    }
    req.body = result.data;
    next();
  };
}
