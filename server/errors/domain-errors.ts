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

/** Request was well-formed but could not be fulfilled (HTTP 422). */
export class UnprocessableEntityError extends DomainError {
  constructor(message: string) {
    super(message, 422);
  }
}

/** An upstream service returned something unusable (HTTP 502). */
export class UpstreamError extends DomainError {
  constructor(message: string) {
    super(message, 502);
  }
}

/** An upstream service is unreachable or unauthenticated (HTTP 503). */
export class ServiceUnavailableError extends DomainError {
  constructor(message: string) {
    super(message, 503);
  }
}
