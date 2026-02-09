import type { Request, Response } from 'express';

/**
 * Parse a numeric route parameter, sending a 400 response if invalid.
 * Returns the parsed number, or null if the response was already sent.
 */
export function parseIdParam(req: Request, res: Response, paramName: string = 'id'): number | null {
  const value = parseInt(req.params[paramName], 10);
  if (isNaN(value)) {
    res.status(400).json({ error: `Invalid ${paramName} parameter — must be a number` });
    return null;
  }
  return value;
}
