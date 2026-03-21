import type { Request, Response, NextFunction } from 'express';
import { DomainError } from '../errors/domain-errors.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error stack to console
  console.error('Error:', err.stack);

  // Use the statusCode carried by DomainError subclasses;
  // fall back to 500 for unexpected errors.
  const statusCode = err instanceof DomainError ? err.statusCode : 500;

  // Send error response
  res.status(statusCode).json({
    error: err.message,
  });
}
