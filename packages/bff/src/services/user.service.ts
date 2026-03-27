/**
 * UserService — profile management, notification preferences.
 * User statistics and DTO building shared with AuthService via buildUserDto.
 */
import { injectable, inject } from 'tsyringe';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import type {
  UserDto,
  PublicUserProfileDto,
  UpdateUserDto,
  NotificationPreferencesDto,
} from 'common';

@injectable()
export class UserService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(AuthService) private readonly authService: AuthService
  ) {}

  async getUser(userId: string): Promise<UserDto> {
    return this.authService.buildUserDto(userId);
  }

  async updateUsername(userId: string, dto: UpdateUserDto, ipAddress?: string): Promise<UserDto> {
    if (!dto.username) throw new ValidationError('username is required');

    const existing = await this.prisma.user.findFirst({
      where: { username: dto.username, NOT: { id: userId } },
    });
    if (existing !== null) throw new ConflictError('Username already in use');

    await this.prisma.user.update({
      where: { id: userId },
      data: { username: dto.username },
    });

    this.audit.log({
      userId,
      action: 'user.username_updated',
      entityType: 'user',
      entityId: userId,
      changes: { username: dto.username },
      ipAddress,
    });

    return this.authService.buildUserDto(userId);
  }

  async updateNotificationPreferences(
    userId: string,
    dto: NotificationPreferencesDto,
    ipAddress?: string
  ): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) throw new NotFoundError('User not found');

    const currentPrefs = (user.notification_preferences as Record<string, unknown>) ?? {};
    // SAFETY: notification_preferences is a JSON-serializable object.
    // Cast required because Prisma's InputJsonObject demands an index signature.
    const newPrefs = { ...currentPrefs, ...dto } as Prisma.InputJsonValue;

    await this.prisma.user.update({
      where: { id: userId },
      data: { notification_preferences: newPrefs },
    });

    this.audit.log({
      userId,
      action: 'user.notification_preferences_updated',
      entityType: 'user',
      entityId: userId,
      ipAddress,
    });

    return this.authService.buildUserDto(userId);
  }

  async getPublicProfile(targetUserId: string): Promise<PublicUserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (user === null) throw new NotFoundError('User not found');

    const [contribStats, campaignCount, resolvedCount] = await Promise.all([
      this.prisma.contribution.aggregate({
        where: { contributor_id: targetUserId, status: 'completed' },
        _sum: { amount_usd: true },
      }),
      this.prisma.campaign.count({ where: { creator_id: targetUserId } }),
      this.prisma.campaign.count({ where: { creator_id: targetUserId, status: 'resolved' } }),
    ]);

    return {
      id: user.id,
      username: user.username ?? null,
      stats: {
        total_contributed_usd: Number(contribStats._sum.amount_usd ?? 0),
        campaigns_created: campaignCount,
        campaigns_successful: resolvedCount,
      },
      created_at: user.created_at.toISOString(),
    };
  }
}
