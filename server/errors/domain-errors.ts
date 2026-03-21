/**
 * Base class for all domain-specific errors.
 * Each subclass carries a statusCode so the error handler can map
 * domain errors to HTTP responses without string-matching.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Resource was not found (HTTP 404). */
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404);
  }
}

/** Request failed validation (HTTP 400). */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

/** Operation conflicts with current resource state (HTTP 409). */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
  }
}
