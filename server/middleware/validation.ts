import type { Request, Response } from 'express';
import { ValidationError } from '../errors/domain-errors.js';

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

/**
 * Parse an optional integer query parameter.
 * Returns the parsed integer, or `defaultValue` when the parameter is absent.
 * Throws ValidationError when the value is present but not a valid integer.
 */
export function parseQueryParamInt(
  value: string | undefined,
  paramName: string,
  defaultValue?: number
): number {
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new ValidationError(`${paramName} query parameter is required`);
  }

  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new ValidationError(`${paramName} must be a valid integer`);
  }
  return parsed;
}
