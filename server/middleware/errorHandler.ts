import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error stack to console
  console.error('Error:', err.stack);

  // Determine status code based on error message
  let statusCode = 500;
  if (err.message.includes('not found')) {
    statusCode = 404;
  }

  // Send error response
  res.status(statusCode).json({
    error: err.message,
  });
}
