/**
 * ContributionService — spec §7.9 (contribute flow) and §9.5.
 * All balance-moving operations use SERIALIZABLE isolation (coding rules §3.5).
 */
import { injectable, inject } from 'tsyringe';
import { Prisma } from '@prisma/client';
import pino from 'pino';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { ConfigurationService, type GlobalMinimumsConfig } from './configuration.service';
import {
  ConflictError,
  AuthorizationError,
  ValidationError,
  InsufficientBalanceError,
  NotFoundError,
} from '../utils/errors';
import type { ContributeDto, ContributionDto, PaginatedResponseDto } from 'common';

const logger = pino({ name: 'ContributionService' });

@injectable()
export class ContributionService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(NotificationService) private readonly notifService: NotificationService,
    @inject(ConfigurationService) private readonly configService: ConfigurationService
  ) {}

  /**
   * Contribute to a campaign — spec §7.9.
   * SERIALIZABLE transaction: debit user, credit escrow, update funding, insert records.
   * Post-transaction: check threshold → auto-advance to funded if crossed.
   */
  async contribute(
    userId: string,
    campaignId: string,
    dto: ContributeDto,
    isEmailVerified: boolean,
    isBanned: boolean
  ): Promise<ContributionDto> {
    // Guards
    if (isBanned) throw new AuthorizationError('Account suspended');
    if (!isEmailVerified) throw new AuthorizationError('Email verification required');

    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (campaign === null) throw new NotFoundError('Campaign not found');

    if (campaign.creator_id === userId) {
      throw new ConflictError('Campaign creators cannot contribute to their own campaign');
    }

    if (campaign.status !== 'created' && campaign.status !== 'funded') {
      throw new ConflictError('Campaign is not accepting contributions');
    }

    if (campaign.is_flagged_for_review) {
      throw new ConflictError('Campaign is under review and not accepting contributions');
    }

    const globalMinimums = await this.configService.get<GlobalMinimumsConfig>('global_minimums');
    if (dto.amount < globalMinimums.min_contribution_usd) {
      throw new ValidationError(
        `Minimum contribution is ${globalMinimums.min_contribution_usd} USD`
      );
    }

    // Check balance before transaction (Option B: single unified balance)
    const account = await this.prisma.ledgerAccount.findUnique({ where: { user_id: userId } });
    if (account === null) throw new NotFoundError('Ledger account not found');

    if (Number(account.balance) < dto.amount) {
      throw new InsufficientBalanceError('Insufficient balance');
    }

    const amountDecimal = new Prisma.Decimal(dto.amount);
    let contributionId = '';
    let updatedFunding = new Prisma.Decimal(0);

    // SERIALIZABLE transaction (coding rules §3.5)
    await this.prisma.$transaction(
      async (tx) => {
        // 1. Re-read account with FOR UPDATE equivalent
        const lockedAccount = await tx.ledgerAccount.findUniqueOrThrow({
          where: { user_id: userId },
        });

        if (Number(lockedAccount.balance) < dto.amount) {
          throw new InsufficientBalanceError('Insufficient balance');
        }

        // 2. Debit user (coding rules §5.2 — debit before credit)
        await tx.ledgerAccount.update({
          where: { user_id: userId },
          data: { balance: { decrement: amountDecimal } },
        });

        // 3. Credit campaign escrow
        await tx.campaignEscrow.update({
          where: { campaign_id: campaignId },
          data: { balance: { increment: amountDecimal } },
        });

        // 4. Update campaign current funding
        const updated = await tx.campaign.update({
          where: { id: campaignId },
          data: { current_funding_usd: { increment: amountDecimal } },
        });
        updatedFunding = updated.current_funding_usd;

        // 5. Insert Contribution
        const contribution = await tx.contribution.create({
          data: {
            campaign_id: campaignId,
            contributor_id: userId,
            amount_usd: amountDecimal,
            currency: dto.currency,
            status: 'completed',
          },
        });
        contributionId = contribution.id;

        // 6. Insert LedgerTransaction
        await tx.ledgerTransaction.create({
          data: {
            transaction_type: 'contribution',
            currency: dto.currency,
            amount: amountDecimal,
            from_account_type: 'user',
            from_account_id: userId,
            to_account_type: 'campaign',
            to_account_id: campaignId,
            reference_id: contribution.id,
            status: 'completed',
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    this.audit.log({
      userId,
      action: 'contribution.created',
      entityType: 'contribution',
      entityId: contributionId,
      changes: { amount: dto.amount, currency: dto.currency, campaignId },
    });

    // Post-transaction: check if threshold was crossed
    if (updatedFunding.gte(campaign.funding_threshold_usd) && campaign.funded_at === null) {
      await this.autoAdvanceToFunded(campaignId, campaign.creator_id);
    }

    logger.info(
      { userId, campaignId, amount: dto.amount, currency: dto.currency },
      'Contribution created'
    );

    return this.buildContributionDto(contributionId, campaignId, userId);
  }

  /** Auto-advance campaign to funded when threshold is first crossed. */
  private async autoAdvanceToFunded(campaignId: string, creatorId: string): Promise<void> {
    const now = new Date();
    const deadlineShipSamples = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'funded',
          funded_at: now,
          deadline_ship_samples: deadlineShipSamples,
        },
      });
      await tx.campaignUpdate.create({
        data: {
          campaign_id: campaignId,
          author_id: creatorId,
          content: 'Campaign reached funding threshold',
          update_type: 'state_change',
          state_change_from: 'created',
          state_change_to: 'funded',
        },
      });
    });

    // Notify creator and contributors
    await this.notifService.send(
      creatorId,
      'campaign_funded',
      campaignId,
      'Campaign Funded! 🎉',
      'Your campaign has reached the funding threshold.'
    );
    await this.notifService.sendToAllContributors(
      campaignId,
      'campaign_funded',
      'Campaign Funded! 🎉',
      'The campaign you backed has reached its funding goal.'
    );
  }

  async getUserContributions(
    userId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<PaginatedResponseDto<ContributionDto>> {
    const skip = (page - 1) * limit;
    const where = {
      contributor_id: userId,
      ...(status ? { status: status as 'completed' | 'refunded' } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        orderBy: { contributed_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contribution.count({ where }),
    ]);

    const campaignIds = [...new Set(rows.map((r) => r.campaign_id))];
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, title: true },
    });
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.title]));

    const userIds = [...new Set(rows.map((r) => r.contributor_id))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      data: rows.map((r) => ({
        id: r.id,
        campaign_id: r.campaign_id,
        campaign_title: campaignMap.get(r.campaign_id) ?? '',
        contributor: {
          id: r.contributor_id,
          username: userMap.get(r.contributor_id)?.username ?? null,
        },
        amount_usd: Number(r.amount_usd),
        currency: r.currency,
        status: r.status,
        contributed_at: r.contributed_at.toISOString(),
        refunded_at: r.refunded_at?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  private async buildContributionDto(
    contributionId: string,
    campaignId: string,
    contributorId: string
  ): Promise<ContributionDto> {
    const [contribution, campaign, contributor] = await Promise.all([
      this.prisma.contribution.findUniqueOrThrow({ where: { id: contributionId } }),
      this.prisma.campaign.findUniqueOrThrow({
        where: { id: campaignId },
        select: { title: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: contributorId },
        select: { id: true, username: true },
      }),
    ]);

    return {
      id: contribution.id,
      campaign_id: contribution.campaign_id,
      campaign_title: campaign.title,
      contributor: { id: contributor.id, username: contributor.username ?? null },
      amount_usd: Number(contribution.amount_usd),
      currency: contribution.currency,
      status: contribution.status,
      contributed_at: contribution.contributed_at.toISOString(),
      refunded_at: contribution.refunded_at?.toISOString() ?? null,
    };
  }
}
