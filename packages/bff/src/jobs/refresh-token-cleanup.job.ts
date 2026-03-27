/**
 * RefreshTokenCleanupJob — daily cleanup of expired refresh tokens. Spec §10.7.
 * Deletes rows WHERE expires_at < now() - 7 days.
 */
import pino from 'pino';
import { container } from '../container';
import { refreshTokenCleanupQueue } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';

const logger = pino({ name: 'RefreshTokenCleanupJob' });

export function startRefreshTokenCleanupJob(): void {
  void refreshTokenCleanupQueue.add(
    {},
    { repeat: { every: 24 * 60 * 60_000 }, jobId: 'refresh-token-cleanup-repeatable' }
  );

  void refreshTokenCleanupQueue.process(1, async () => {
    const prisma = container.resolve(PrismaService);
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // now - 7 days
    const result = await prisma.refreshToken.deleteMany({
      where: { expires_at: { lt: cutoff } },
    });
    logger.info({ deleted: result.count }, 'Refresh token cleanup complete');
  });
}
