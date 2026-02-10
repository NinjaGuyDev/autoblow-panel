import type { Request, Response } from 'express';

/**
 * Parse a numeric route parameter, sending a 400 response if invalid.
 * Returns the parsed number, or null if the response was already sent.
 */
export function parseIdParam(req: Request, res: Response, paramName: string = 'id'): number | null {
  const raw = req.params[paramName];
  const value = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  if (isNaN(value)) {
    res.status(400).json({ error: `Invalid ${paramName} parameter — must be a number` });
    return null;
  }
  return value;
}
