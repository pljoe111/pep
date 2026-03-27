/**
 * LeaderboardService — spec §9.11.
 * Contributors ranked by total contributed USD across completed contributions
 * to non-refunded campaigns. Creators ranked by resolved campaign count.
 * Banned users excluded from both. monthly = current calendar month UTC.
 *
 * Note: No Prisma @relation directives in schema — must join manually.
 */
import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma.service';
import type { LeaderboardEntryDto } from 'common';

@injectable()
export class LeaderboardService {
  constructor(@inject(PrismaService) private readonly prisma: PrismaService) {}

  async getContributors(
    period: 'all' | 'monthly' = 'all',
    limit = 10
  ): Promise<LeaderboardEntryDto[]> {
    const dateFilter = period === 'monthly' ? this.currentMonthStart() : undefined;

    // Get non-refunded campaign IDs (contributions to refunded campaigns excluded per spec)
    const validCampaigns = await this.prisma.campaign.findMany({
      where: { status: { not: 'refunded' } },
      select: { id: true },
    });
    const validCampaignIds = validCampaigns.map((c) => c.id);

    // Aggregate total contributed USD per contributor
    const rows = await this.prisma.contribution.groupBy({
      by: ['contributor_id'],
      where: {
        status: 'completed',
        campaign_id: { in: validCampaignIds },
        ...(dateFilter !== undefined ? { contributed_at: { gte: dateFilter } } : {}),
      },
      _sum: { amount_usd: true },
      orderBy: { _sum: { amount_usd: 'desc' } },
      take: limit,
    });

    const userIds = rows.map((r) => r.contributor_id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, is_banned: false },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries: LeaderboardEntryDto[] = [];
    let rank = 1;
    for (const row of rows) {
      const user = userMap.get(row.contributor_id);
      if (user === undefined) continue; // banned user — skip
      entries.push({
        rank: rank++,
        user: { id: user.id, username: user.username ?? null },
        // SAFETY: _sum is defined when groupBy returns rows; fallback to 0 for null amount.
        value: Number(row._sum.amount_usd ?? 0),
        period,
      });
    }
    return entries;
  }

  async getCreators(period: 'all' | 'monthly' = 'all', limit = 10): Promise<LeaderboardEntryDto[]> {
    const dateFilter = period === 'monthly' ? this.currentMonthStart() : undefined;

    const rows = await this.prisma.campaign.groupBy({
      by: ['creator_id'],
      where: {
        status: 'resolved',
        ...(dateFilter !== undefined ? { resolved_at: { gte: dateFilter } } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { creator_id: 'desc' } },
      take: limit,
    });

    const userIds = rows.map((r) => r.creator_id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, is_banned: false },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries: LeaderboardEntryDto[] = [];
    let rank = 1;
    for (const row of rows) {
      const user = userMap.get(row.creator_id);
      if (user === undefined) continue; // banned user — skip
      entries.push({
        rank: rank++,
        user: { id: user.id, username: user.username ?? null },
        value: row._count._all,
        period,
      });
    }
    return entries;
  }

  private currentMonthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
