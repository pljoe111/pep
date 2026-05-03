/**
 * tsoa authentication middleware.
 *
 * tsoa calls expressAuthentication(request, securityName, scopes?) for each
 * route decorated with @Security('jwt'). Resolving returns the decoded payload
 * (attached as the user context). Rejecting causes tsoa to call next(error),
 * which our global error handler maps to a 401/403 response.
 *
 * Coding rules §8.1: all env access via env.config.ts.
 * Coding rules §8.2: JWT_SECRET is never logged.
 */
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import type { ClaimType } from 'common';
import type { Request as ExpressRequest } from 'express';

/** Express request enriched by expressAuthentication (tsoa §Security routes). */
export type AuthRequest = ExpressRequest & { user: JwtPayload };

export interface JwtPayload {
  userId: string;
  email: string;
  emailVerified: boolean;
  claims: ClaimType[];
  isBanned: boolean;
}

/**
 * Called by tsoa-generated routes for every @Security('jwt') endpoint.
 * Returns a resolved Promise<JwtPayload> on success; a rejected Promise on failure.
 */
export function expressAuthentication(
  request: Request,
  securityName: string,
  scopes?: string[]
): Promise<JwtPayload> {
  if (securityName !== 'jwt') {
    return Promise.reject(new AuthenticationError(`Unknown security scheme: ${securityName}`));
  }

  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Promise.reject(new AuthenticationError('Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7); // strip "Bearer "

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    return Promise.reject(new AuthenticationError(`Token verification failed: ${message}`));
  }

  if (decoded.isBanned) {
    return Promise.reject(new AuthorizationError('Account suspended'));
  }

  // When an endpoint declares required scopes, the user must hold at least one
  // of them (ANY-of semantics). Empty/absent scopes → authentication-only check.
  if (scopes !== undefined && scopes.length > 0) {
    const hasRequiredClaim = scopes.some((scope) => decoded.claims.includes(scope as ClaimType));
    if (!hasRequiredClaim) {
      return Promise.reject(new AuthorizationError('Insufficient permissions'));
    }
  }

  return Promise.resolve(decoded);
}
