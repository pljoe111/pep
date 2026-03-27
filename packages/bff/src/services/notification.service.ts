/**
 * NotificationService — spec §4.22, §1 design decision.
 *
 * send() checks notification_preferences before inserting a DB row (in_app)
 * or enqueuing email. If in_app: false → no DB row. If email: false → no email job.
 */
import { injectable, inject } from 'tsyringe';
import pino from 'pino';
import { PrismaService } from './prisma.service';
import { emailQueue, type EmailJobPayload } from '../utils/queue.util';
import type {
  NotificationDto,
  UnreadCountDto,
  MarkAllReadResponseDto,
  NotificationType,
  PaginatedResponseDto,
} from 'common';
import { NotFoundError, AuthorizationError } from '../utils/errors';

const logger = pino({ name: 'NotificationService' });

interface NotifPrefChannel {
  email: boolean;
  in_app: boolean;
}
type NotifPrefs = Record<string, NotifPrefChannel>;

@injectable()
export class NotificationService {
  constructor(@inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Send a notification to a single user, respecting their preferences.
   */
  async send(
    userId: string,
    type: NotificationType,
    campaignId: string,
    title: string,
    message: string
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) return; // silently skip if user not found

    // SAFETY: notification_preferences is always a JSON object with the prefs schema.
    const prefs = (user.notification_preferences as unknown as NotifPrefs) ?? {};
    const channelPrefs = prefs[type] ?? { email: true, in_app: true };

    if (channelPrefs.in_app) {
      await this.prisma.notification
        .create({
          data: {
            user_id: userId,
            notification_type: type,
            campaign_id: campaignId,
            title,
            message,
            sent_email: false,
          },
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error({ error: msg, userId, type }, 'Failed to create notification');
        });
    }

    if (channelPrefs.email && user.email) {
      const emailPayload: EmailJobPayload = {
        to: user.email,
        subject: title,
        html: `<p>${message}</p>`,
        text: message,
      };
      await emailQueue.add(emailPayload).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ error: msg, userId, type }, 'Failed to enqueue email notification');
      });
    }
  }

  /**
   * Send to all unique contributors of a campaign.
   */
  async sendToAllContributors(
    campaignId: string,
    type: NotificationType,
    title: string,
    message: string
  ): Promise<void> {
    const contribs = await this.prisma.contribution.findMany({
      where: { campaign_id: campaignId, status: 'completed' },
      select: { contributor_id: true },
      distinct: ['contributor_id'],
    });

    await Promise.all(
      contribs.map((c) => this.send(c.contributor_id, type, campaignId, title, message))
    );
  }

  // ─── §9.8 Notification endpoints ─────────────────────────────────────────

  async getAll(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponseDto<NotificationDto>> {
    const skip = (page - 1) * limit;
    const where = { user_id: userId };

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ is_read: 'asc' }, { created_at: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: rows.map((n) => ({
        id: n.id,
        user_id: n.user_id,
        notification_type: n.notification_type,
        campaign_id: n.campaign_id,
        title: n.title,
        message: n.message,
        is_read: n.is_read,
        sent_email: n.sent_email,
        created_at: n.created_at.toISOString(),
        read_at: n.read_at?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountDto> {
    const count = await this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (notification === null) throw new NotFoundError('Notification not found');
    if (notification.user_id !== userId) throw new AuthorizationError('Not your notification');

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true, read_at: new Date() },
    });

    return {
      id: updated.id,
      user_id: updated.user_id,
      notification_type: updated.notification_type,
      campaign_id: updated.campaign_id,
      title: updated.title,
      message: updated.message,
      is_read: updated.is_read,
      sent_email: updated.sent_email,
      created_at: updated.created_at.toISOString(),
      read_at: updated.read_at?.toISOString() ?? null,
    };
  }

  async markAllRead(userId: string): Promise<MarkAllReadResponseDto> {
    const result = await this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    return { marked_count: result.count };
  }
}
