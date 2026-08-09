import { HttpStatus } from '@nestjs/common';

/**
 * Base class for every business-rule failure in Zitto.
 *
 * Domain exceptions are deliberately *not* `HttpException` subclasses: they carry
 * a stable machine-readable `code` that clients can branch on, and the RFC 7807
 * filter is the only thing that decides how they become HTTP.
 */
export abstract class DomainException extends Error {
  abstract readonly code: string;
  abstract readonly status: HttpStatus;
  abstract readonly title: string;

  readonly details?: Array<{ path: string; message: string }>;

  protected constructor(message: string, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class NotFoundDomainException extends DomainException {
  readonly code = 'NOT_FOUND';
  readonly status = HttpStatus.NOT_FOUND;
  readonly title = 'Not Found';

  constructor(resource: string, identifier?: string) {
    super(
      identifier
        ? `${resource} '${identifier}' was not found.`
        : `${resource} was not found.`,
    );
  }
}

export class ConflictDomainException extends DomainException {
  readonly code: string;
  readonly status = HttpStatus.CONFLICT;
  readonly title = 'Conflict';

  constructor(message: string, code = 'CONFLICT') {
    super(message);
    this.code = code;
  }
}

export class ForbiddenDomainException extends DomainException {
  readonly code: string;
  readonly status = HttpStatus.FORBIDDEN;
  readonly title = 'Forbidden';

  constructor(message: string, code = 'FORBIDDEN') {
    super(message);
    this.code = code;
  }
}

export class UnauthorizedDomainException extends DomainException {
  readonly code: string;
  readonly status = HttpStatus.UNAUTHORIZED;
  readonly title = 'Unauthorized';

  constructor(message: string, code = 'UNAUTHORIZED') {
    super(message);
    this.code = code;
  }
}

export class ValidationDomainException extends DomainException {
  readonly code: string;
  readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  readonly title = 'Unprocessable Entity';

  constructor(
    message: string,
    code = 'VALIDATION_FAILED',
    details?: Array<{ path: string; message: string }>,
  ) {
    super(message, details);
    this.code = code;
  }
}

export class RateLimitDomainException extends DomainException {
  readonly code: string;
  readonly status = HttpStatus.TOO_MANY_REQUESTS;
  readonly title = 'Too Many Requests';

  constructor(message: string, code = 'RATE_LIMITED') {
    super(message);
    this.code = code;
  }
}
