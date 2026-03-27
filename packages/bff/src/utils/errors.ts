/**
 * Application error classes — spec §6
 *
 * All errors respond with:
 *   { "error": "ErrorClassName", "message": "Human-readable message", "details": {} }
 *
 * Error middleware (not controllers) is the sole place that calls res.status().
 */

export interface ErrorResponseBody {
  error: string;
  message: string;
  details: Record<string, unknown>;
}

abstract class AppError extends Error {
  abstract readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    // Restore prototype chain — required when extending built-in Error in TS
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toResponseBody(): ErrorResponseBody {
    return {
      error: this.name,
      message: this.message,
      details: this.details,
    };
  }
}

/** 400 — Invalid input, failed class-validator */
export class ValidationError extends AppError {
  readonly statusCode = 400;
}

/** 401 — Missing/invalid/expired JWT or refresh token */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
}

/** 403 — Valid JWT, insufficient claims, banned user, unverified email */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
}

/** 404 — Entity not found */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
}

/** 409 — Wrong state for operation */
export class ConflictError extends AppError {
  readonly statusCode = 409;
}

/** 422 — Balance < amount */
export class InsufficientBalanceError extends AppError {
  readonly statusCode = 422;
}

/** 429 — Withdrawal limit exceeded */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
}

/** 500 — Unexpected errors */
export class InternalError extends AppError {
  readonly statusCode = 500;
}

/** Type guard: is this one of our domain errors? */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
