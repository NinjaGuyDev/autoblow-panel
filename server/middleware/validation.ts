import type { Request, Response } from 'express';
import { ValidationError } from '../errors/domain-errors.js';

const STRICT_INTEGER_RE = /^\d+$/;

/**
 * Validate that a raw query parameter value is a string (not an array or object).
 * Throws ValidationError if the value is present but not a plain string.
 */
export function requireStringQueryParam(
  raw: unknown,
  paramName: string
): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw new ValidationError(`${paramName} query parameter must be a single string value`);
  }
  return raw;
}

/**
 * Parse a numeric route parameter, sending a 400 response if invalid.
 * Returns the parsed number, or null if the response was already sent.
 */
export function parseIdParam(req: Request, res: Response, paramName: string = 'id'): number | null {
  const raw = req.params[paramName];
  if (!STRICT_INTEGER_RE.test(raw)) {
    res.status(400).json({ error: `Invalid ${paramName} parameter — must be a number` });
    return null;
  }
  return parseInt(raw, 10);
}

/**
 * Parse an optional integer query parameter.
 * Returns the parsed integer, or `defaultValue` when the parameter is absent.
 * Throws ValidationError when the value is present but not a strictly numeric string.
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

  if (!STRICT_INTEGER_RE.test(value)) {
    throw new ValidationError(`${paramName} must be a valid integer`);
  }
  return parseInt(value, 10);
}
