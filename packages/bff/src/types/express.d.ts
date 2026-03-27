/**
 * Augments Express.Request to include the `user` property populated by
 * tsoa's expressAuthentication handler after JWT verification.
 */
import type { JwtPayload } from '../middleware/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
