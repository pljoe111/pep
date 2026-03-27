/**
 * DeadlineMonitorJob — checks for expired campaigns and triggers refunds. Spec §7.18.
 * Frequency: every 5 minutes, concurrency 1.
 * Skips campaigns with pending COA (spec §1 design decision).
 */
import pino from 'pino';
import { container } from '../container';
import { deadlineMonitorQueue } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { CampaignService } from '../services/campaign.service';

const logger = pino({ name: 'DeadlineMonitorJob' });

export function startDeadlineMonitorJob(): void {
  void deadlineMonitorQueue.add(
    {},
    { repeat: { every: 5 * 60_000 }, jobId: 'deadline-monitor-repeatable' }
  );

  void deadlineMonitorQueue.process(1, async () => {
    const prisma = container.resolve(PrismaService);
    const campaignService = container.resolve(CampaignService);
    const now = new Date();

    // Find expired campaigns across all non-terminal statuses
    const expiredCampaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          { status: 'created', deadline_fundraising: { lt: now } },
          { status: 'funded', deadline_ship_samples: { lt: now } },
          { status: 'samples_sent', deadline_publish_results: { lt: now } },
        ],
      },
    });

    logger.info({ count: expiredCampaigns.length }, 'Deadline monitor checking expired campaigns');

    for (const campaign of expiredCampaigns) {
      // Check: skip if any COA is pending OCR (spec §1 design decision + §7.18)
      const pendingCoa = await prisma.coa.findFirst({
        where: { campaign_id: campaign.id, verification_status: 'pending' },
      });

      if (pendingCoa !== null) {
        logger.info({ campaignId: campaign.id }, 'Skipping deadline refund — COA OCR in progress');
        continue;
      }

      const reason = `${campaign.status} deadline expired`;
      try {
        await campaignService.refundContributions(campaign.id, reason);
        logger.info({ campaignId: campaign.id, reason }, 'Deadline refund triggered');
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ campaignId: campaign.id, error: msg }, 'Deadline refund failed');
        // Never block the batch (spec §7.18)
      }
    }
  });
}
