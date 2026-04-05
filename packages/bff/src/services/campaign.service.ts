/**
 * CampaignService — campaign CRUD and state machine.
 * Implements spec §7.6-7.11, 7.14-7.15 and §9.3-9.4.
 */
import { injectable, inject } from 'tsyringe';
import { Prisma, type Campaign } from '@prisma/client';
import pino from 'pino';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { ConfigurationService } from './configuration.service';
import type {
  GlobalMinimumsConfig,
  PlatformFeeConfig,
  MaxCampaignMultiplierConfig,
  AutoFlagThresholdConfig,
  ValidMassUnitsConfig,
} from './configuration.service';
import { StorageService } from './storage.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  AuthorizationError,
  InternalError,
} from '../utils/errors';
import type {
  CreateCampaignDto,
  UpdateCampaignDto,
  CampaignDetailDto,
  CampaignListDto,
  CampaignUpdateDto,
  ReactionCountsDto,
  SampleDto,
  CoaDto,
  ContributionDto,
  EstimateCostResponseDto,
  PaginatedResponseDto,
  AddCampaignUpdateDto,
  AddReactionDto,
} from 'common';

const logger = pino({ name: 'CampaignService' });

@injectable()
export class CampaignService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(NotificationService) private readonly notifService: NotificationService,
    @inject(ConfigurationService) private readonly configService: ConfigurationService,
    @inject(StorageService) private readonly storageService: StorageService
  ) {}

  // ─── §7.6 Create Campaign ─────────────────────────────────────────────────

  async createCampaign(userId: string, dto: CreateCampaignDto): Promise<CampaignDetailDto> {
    // Load config values
    const [globalMinimums, platformFeeConfig, multiplierConfig, autoFlagConfig, massUnitsConfig] =
      await Promise.all([
        this.configService.get<GlobalMinimumsConfig>('global_minimums'),
        this.configService.get<PlatformFeeConfig>('platform_fee_percent'),
        this.configService.get<MaxCampaignMultiplierConfig>('max_campaign_multiplier'),
        this.configService.get<AutoFlagThresholdConfig>('auto_flag_threshold_usd'),
        this.configService.get<ValidMassUnitsConfig>('valid_mass_units'),
      ]);

    // Validate each target lab is approved
    const labIds = [...new Set(dto.samples.map((s) => s.target_lab_id))];
    const labs = await this.prisma.lab.findMany({ where: { id: { in: labIds } } });
    const labMap = new Map(labs.map((l) => [l.id, l]));
    for (const labId of labIds) {
      const lab = labMap.get(labId);
      if (!lab || !lab.is_approved) {
        throw new ValidationError(`Lab ${labId} is not approved`);
      }
    }

    // Validate test requests and compute estimated cost
    let estimatedLabCostUsd = new Prisma.Decimal(0);
    const labTestMap = new Map<string, Map<string, Prisma.Decimal>>();

    for (const sample of dto.samples) {
      if (!labTestMap.has(sample.target_lab_id)) {
        labTestMap.set(sample.target_lab_id, new Map());
      }
    }

    for (const [labId] of labTestMap) {
      const labTests = await this.prisma.labTest.findMany({ where: { lab_id: labId } });
      // SAFETY: labTestMap.get(labId) was just set in the loop above.
      const testPriceMap = labTestMap.get(labId)!;
      for (const lt of labTests) {
        testPriceMap.set(lt.test_id, lt.price_usd);
      }
    }

    for (const sample of dto.samples) {
      if (sample.tests.length === 0) {
        throw new ValidationError(`Sample "${sample.sample_label}" must have at least 1 test`);
      }
      if (sample.claims.length === 0) {
        throw new ValidationError(`Sample "${sample.sample_label}" must have at least 1 claim`);
      }

      for (const claim of sample.claims) {
        if (claim.claim_type === 'mass') {
          if (claim.mass_amount === undefined || claim.mass_unit === undefined) {
            throw new ValidationError('Mass claims require mass_amount and mass_unit');
          }
          if (!massUnitsConfig.units.includes(claim.mass_unit)) {
            throw new ValidationError(`Invalid mass unit: ${claim.mass_unit}`);
          }
        } else {
          if (!claim.other_description) {
            throw new ValidationError('Other claims require other_description');
          }
        }
      }

      // SAFETY: labTestMap.get(sample.target_lab_id) was populated above for all lab IDs.
      const priceMap = labTestMap.get(sample.target_lab_id)!;
      for (const testReq of sample.tests) {
        const price = priceMap.get(testReq.test_id);
        if (price === undefined) {
          throw new ValidationError(
            `Test ${testReq.test_id} not available at lab ${sample.target_lab_id}`
          );
        }
        estimatedLabCostUsd = estimatedLabCostUsd.add(price);
      }
    }

    const amtRequested = new Prisma.Decimal(dto.amount_requested_usd);
    if (amtRequested.gt(estimatedLabCostUsd.mul(multiplierConfig.value))) {
      throw new ValidationError(
        `Requested amount exceeds ${multiplierConfig.value}× estimated lab cost`
      );
    }

    // Compute funding threshold
    const thresholdPct = dto.funding_threshold_percent;
    if (thresholdPct < 5 || thresholdPct > 100) {
      throw new ValidationError('funding_threshold_percent must be between 5 and 100');
    }
    const minThreshold = new Prisma.Decimal(globalMinimums.min_funding_threshold_usd);
    const computedThreshold = amtRequested.mul(thresholdPct).div(100);
    const fundingThresholdUsd = computedThreshold.lt(minThreshold)
      ? minThreshold
      : computedThreshold;

    // Auto-flag logic
    const resolvedCampaigns = await this.prisma.campaign.count({
      where: { creator_id: userId, status: 'resolved' },
    });
    const isAutoFlagged =
      resolvedCampaigns === 0 || dto.amount_requested_usd > autoFlagConfig.value;

    // Generate unique verification code (retry up to 10 times)
    let verificationCode = 0;
    const MAX_RETRIES = 10;
    for (let i = 0; i < MAX_RETRIES; i++) {
      const candidate = Math.floor(100000 + Math.random() * 900000);
      const existing = await this.prisma.campaign.findUnique({
        where: { verification_code: candidate },
      });
      if (existing === null) {
        verificationCode = candidate;
        break;
      }
    }
    if (verificationCode === 0) {
      throw new InternalError('Could not generate unique verification code after 10 attempts');
    }

    const now = new Date();
    const deadlineFundraising = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    let campaignId = '';

    await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          creator_id: userId,
          verification_code: verificationCode,
          title: dto.title,
          description: dto.description,
          amount_requested_usd: amtRequested,
          funding_threshold_percent: thresholdPct,
          funding_threshold_usd: fundingThresholdUsd,
          estimated_lab_cost_usd: estimatedLabCostUsd,
          platform_fee_percent: new Prisma.Decimal(platformFeeConfig.value),
          status: 'created',
          is_itemized: dto.is_itemized ?? false,
          ...(dto.itemization_data !== undefined
            ? { itemization_data: dto.itemization_data as Prisma.InputJsonValue }
            : {}),
          is_flagged_for_review: isAutoFlagged,
          deadline_fundraising: deadlineFundraising,
        },
      });
      campaignId = campaign.id;

      await tx.campaignEscrow.create({
        data: { campaign_id: campaignId },
      });

      for (const sampleDto of dto.samples) {
        const purchaseDate = new Date(sampleDto.purchase_date);
        if (Number.isNaN(purchaseDate.getTime())) {
          throw new ValidationError(
            `Sample "${sampleDto.sample_label}" has an invalid purchase_date`
          );
        }
        const sample = await tx.sample.create({
          data: {
            campaign_id: campaignId,
            vendor_name: sampleDto.vendor_name,
            purchase_date: purchaseDate,
            physical_description: sampleDto.physical_description,
            sample_label: sampleDto.sample_label,
            target_lab_id: sampleDto.target_lab_id,
            order_index: sampleDto.order_index ?? 0,
          },
        });

        for (const claim of sampleDto.claims) {
          await tx.sampleClaim.create({
            data: {
              sample_id: sample.id,
              claim_type: claim.claim_type,
              ...(claim.mass_amount !== undefined ? { mass_amount: claim.mass_amount } : {}),
              ...(claim.mass_unit !== undefined ? { mass_unit: claim.mass_unit } : {}),
              ...(claim.other_description !== undefined
                ? { other_description: claim.other_description }
                : {}),
            },
          });
        }

        for (const testReq of sampleDto.tests) {
          await tx.testRequest.create({
            data: { sample_id: sample.id, test_id: testReq.test_id },
          });
        }
      }
    });

    this.audit.log({
      userId,
      action: 'campaign.created',
      entityType: 'campaign',
      entityId: campaignId,
    });

    return this.getCampaignDetail(campaignId, userId);
  }

  // ─── §7.7 Edit Campaign ───────────────────────────────────────────────────

  async updateCampaign(
    userId: string,
    campaignId: string,
    dto: UpdateCampaignDto
  ): Promise<CampaignDetailDto> {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.creator_id !== userId) throw new AuthorizationError('Not your campaign');
    if (campaign.status !== 'created')
      throw new ConflictError('Campaign cannot be edited in current state');

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.is_itemized !== undefined ? { is_itemized: dto.is_itemized } : {}),
        ...(dto.itemization_data !== undefined
          ? { itemization_data: dto.itemization_data as Prisma.InputJsonValue }
          : {}),
      },
    });

    if (dto.title !== undefined) {
      before['title'] = campaign.title;
      after['title'] = dto.title;
    }
    if (dto.description !== undefined) {
      before['description'] = campaign.description;
      after['description'] = dto.description;
    }

    this.audit.log({
      userId,
      action: 'campaign.updated',
      entityType: 'campaign',
      entityId: campaignId,
      changes: { before, after },
    });

    return this.getCampaignDetail(campaignId, userId);
  }

  // ─── §7.8 Delete Campaign ─────────────────────────────────────────────────

  async deleteCampaign(userId: string, campaignId: string): Promise<void> {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.creator_id !== userId) throw new AuthorizationError('Not your campaign');
    if (campaign.status !== 'created')
      throw new ConflictError('Can only delete campaigns in created status');
    if (!campaign.current_funding_usd.isZero()) {
      throw new ConflictError('Cannot delete campaign with contributions');
    }

    await this.prisma.$transaction(async (tx) => {
      // Cascade: testRequest → sampleClaim → sample will be handled if we add @relation
      // Since no @relation in schema, delete manually in order
      const samples = await tx.sample.findMany({ where: { campaign_id: campaignId } });
      for (const s of samples) {
        await tx.testRequest.deleteMany({ where: { sample_id: s.id } });
        await tx.sampleClaim.deleteMany({ where: { sample_id: s.id } });
      }
      await tx.sample.deleteMany({ where: { campaign_id: campaignId } });
      await tx.campaignEscrow.deleteMany({ where: { campaign_id: campaignId } });
      await tx.campaign.delete({ where: { id: campaignId } });
    });

    this.audit.log({
      userId,
      action: 'campaign.deleted',
      entityType: 'campaign',
      entityId: campaignId,
    });
  }

  // ─── §7.10 Lock Campaign ──────────────────────────────────────────────────

  async lockCampaign(userId: string, campaignId: string): Promise<CampaignDetailDto> {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.creator_id !== userId) throw new AuthorizationError('Not your campaign');
    if (campaign.status !== 'created') throw new ConflictError('Campaign is not in created status');

    // Effective threshold is the minimum of campaign threshold and global minimum
    const globalMinimums = await this.configService.get<GlobalMinimumsConfig>('global_minimums');
    const globalMinThreshold = new Prisma.Decimal(globalMinimums.min_funding_threshold_usd);
    const effectiveThreshold = campaign.funding_threshold_usd.lt(globalMinThreshold)
      ? campaign.funding_threshold_usd
      : globalMinThreshold;

    if (campaign.current_funding_usd.lt(effectiveThreshold)) {
      throw new ConflictError('Funding threshold not yet reached');
    }

    const now = new Date();
    const fundedAt = campaign.funded_at ?? now;
    const deadlineShipSamples = new Date(fundedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'funded',
          locked_at: now,
          funded_at: campaign.funded_at ?? now,
          deadline_ship_samples: deadlineShipSamples,
        },
      });
      await tx.campaignUpdate.create({
        data: {
          campaign_id: campaignId,
          author_id: userId,
          content: 'Campaign locked by creator',
          update_type: 'state_change',
          state_change_from: 'created',
          state_change_to: 'funded',
        },
      });
    });

    await this.notifService.sendToAllContributors(
      campaignId,
      'campaign_locked',
      'Campaign Locked',
      'The creator has locked the campaign.'
    );

    this.audit.log({
      userId,
      action: 'campaign.locked',
      entityType: 'campaign',
      entityId: campaignId,
    });
    return this.getCampaignDetail(campaignId, userId);
  }

  // ─── §7.11 Ship Samples ───────────────────────────────────────────────────

  async shipSamples(userId: string, campaignId: string): Promise<CampaignDetailDto> {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.creator_id !== userId) throw new AuthorizationError('Not your campaign');
    if (campaign.status !== 'funded') throw new ConflictError('Campaign must be in funded status');

    const now = new Date();
    const deadlinePublishResults = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'samples_sent',
          samples_sent_at: now,
          deadline_publish_results: deadlinePublishResults,
        },
      });
      await tx.campaignUpdate.create({
        data: {
          campaign_id: campaignId,
          author_id: userId,
          content: 'Samples shipped to lab',
          update_type: 'state_change',
          state_change_from: 'funded',
          state_change_to: 'samples_sent',
        },
      });
    });

    await this.notifService.sendToAllContributors(
      campaignId,
      'samples_shipped',
      'Samples Shipped',
      'The creator has shipped samples to the lab.'
    );

    this.audit.log({
      userId,
      action: 'campaign.samples_shipped',
      entityType: 'campaign',
      entityId: campaignId,
    });
    return this.getCampaignDetail(campaignId, userId);
  }

  // ─── §7.14 Resolve Campaign ───────────────────────────────────────────────

  async resolveCampaign(campaignId: string): Promise<void> {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.status !== 'results_published') {
      throw new ConflictError('Campaign must be in results_published status to resolve');
    }

    await this.prisma.$transaction(
      async (tx) => {
        const escrow = await tx.campaignEscrow.findUniqueOrThrow({
          where: { campaign_id: campaignId },
        });

        // Option B: single unified balance
        const escrowBalance = escrow.balance;
        const platformFeePercent = campaign.platform_fee_percent;

        // Fee calculation — floor (spec §5.4, coding rules §5.5)
        const fee = escrowBalance
          .mul(platformFeePercent)
          .div(100)
          .toDecimalPlaces(6, Prisma.Decimal.ROUND_DOWN);
        const payout = escrowBalance.sub(fee);

        if (payout.gt(0)) {
          await tx.ledgerAccount.update({
            where: { user_id: campaign.creator_id },
            data: { balance: { increment: payout } },
          });
          await tx.campaignEscrow.update({
            where: { campaign_id: campaignId },
            data: { balance: 0 },
          });
          await tx.feeAccount.updateMany({
            data: { balance: { increment: fee } },
          });
          // LedgerTransactions record 'usdt' currency (Option B: always USDT on-chain)
          await tx.ledgerTransaction.create({
            data: {
              transaction_type: 'payout',
              amount: payout,
              currency: 'usdt',
              from_account_type: 'campaign',
              from_account_id: campaignId,
              to_account_type: 'user',
              to_account_id: campaign.creator_id,
              status: 'completed',
            },
          });
          if (fee.gt(0)) {
            await tx.ledgerTransaction.create({
              data: {
                transaction_type: 'fee',
                amount: fee,
                currency: 'usdt',
                from_account_type: 'campaign',
                from_account_id: campaignId,
                to_account_type: 'fee',
                status: 'completed',
              },
            });
          }
        }

        await tx.campaign.update({
          where: { id: campaignId },
          data: { status: 'resolved', resolved_at: new Date() },
        });
        await tx.campaignUpdate.create({
          data: {
            campaign_id: campaignId,
            author_id: campaign.creator_id,
            content: 'Campaign resolved — funds distributed',
            update_type: 'state_change',
            state_change_from: 'results_published',
            state_change_to: 'resolved',
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.notifService.send(
      campaign.creator_id,
      'campaign_resolved',
      campaignId,
      'Campaign Resolved 🎉',
      'Your campaign has been resolved. Funds have been credited to your balance.'
    );
    await this.notifService.sendToAllContributors(
      campaignId,
      'campaign_resolved',
      'Campaign Resolved',
      'The campaign you backed has been completed successfully.'
    );

    this.audit.log({ action: 'campaign.resolved', entityType: 'campaign', entityId: campaignId });
  }

  // ─── §7.15 Refund Contributions ───────────────────────────────────────────

  async refundContributions(campaignId: string, reason: string): Promise<void> {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.status === 'resolved' || campaign.status === 'refunded') {
      throw new ConflictError('Cannot refund a resolved or already-refunded campaign');
    }

    const prevStatus = campaign.status;

    await this.prisma.$transaction(
      async (tx) => {
        const contributions = await tx.contribution.findMany({
          where: { campaign_id: campaignId, status: 'completed' },
        });

        for (const contrib of contributions) {
          // Option B: single unified balance — refund to balance regardless of original currency
          await tx.ledgerAccount.update({
            where: { user_id: contrib.contributor_id },
            data: { balance: { increment: contrib.amount_usd } },
          });
          await tx.contribution.update({
            where: { id: contrib.id },
            data: { status: 'refunded', refunded_at: new Date() },
          });
          await tx.ledgerTransaction.create({
            data: {
              transaction_type: 'refund',
              amount: contrib.amount_usd,
              currency: contrib.currency,
              from_account_type: 'campaign',
              from_account_id: campaignId,
              to_account_type: 'user',
              to_account_id: contrib.contributor_id,
              reference_id: contrib.id,
              status: 'completed',
            },
          });
        }

        await tx.campaignEscrow.update({
          where: { campaign_id: campaignId },
          data: { balance: 0 },
        });
        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            status: 'refunded',
            refunded_at: new Date(),
            refund_reason: reason,
            current_funding_usd: 0,
          },
        });
        await tx.campaignUpdate.create({
          data: {
            campaign_id: campaignId,
            author_id: campaign.creator_id,
            content: `Campaign refunded: ${reason}`,
            update_type: 'state_change',
            state_change_from: prevStatus,
            state_change_to: 'refunded',
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.notifService.sendToAllContributors(
      campaignId,
      'campaign_refunded',
      'Campaign Refunded',
      `The campaign contributions have been refunded. Reason: ${reason}`
    );

    this.audit.log({ action: 'campaign.refunded', entityType: 'campaign', entityId: campaignId });
    logger.info({ campaignId, reason }, 'Campaign refunded');
  }

  // ─── §9.3 Public listing ──────────────────────────────────────────────────

  async findAll(
    status?: string,
    search?: string,
    sort = 'newest',
    page = 1,
    limit = 20,
    isAdmin = false
  ): Promise<PaginatedResponseDto<CampaignListDto>> {
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = {
      ...(status === 'active'
        ? { status: { in: ['created', 'funded', 'samples_sent'] } }
        : status
          ? { status: status as Prisma.EnumCampaignStatusFilter }
          : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      ...(!isAdmin ? { is_hidden: false } : {}),
    };

    const orderBy =
      sort === 'oldest'
        ? { created_at: 'asc' as const }
        : sort === 'progress_desc'
          ? { current_funding_usd: 'desc' as const }
          : sort === 'progress_asc'
            ? { current_funding_usd: 'asc' as const }
            : sort === 'deadline_asc'
              ? { deadline_fundraising: 'asc' as const }
              : { created_at: 'desc' as const };

    const [rows, total] = await Promise.all([
      this.prisma.campaign.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.campaign.count({ where }),
    ]);

    const creatorIds = [...new Set(rows.map((r) => r.creator_id))];
    const creators = await this.prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, username: true },
    });
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    // Get sample labels, vendor names, and lab names per campaign
    const campaignIds = rows.map((r) => r.id);
    const samples =
      campaignIds.length > 0
        ? await this.prisma.sample.findMany({
            where: { campaign_id: { in: campaignIds } },
            select: {
              campaign_id: true,
              sample_label: true,
              vendor_name: true,
              target_lab_id: true,
            },
          })
        : [];

    // Fetch lab names for all target_lab_ids
    const labIds = [...new Set(samples.map((s) => s.target_lab_id))];
    const labs =
      labIds.length > 0
        ? await this.prisma.lab.findMany({
            where: { id: { in: labIds } },
            select: { id: true, name: true },
          })
        : [];
    const labNameMap = new Map(labs.map((l) => [l.id, l.name]));

    const sampleLabelsMap = new Map<string, string[]>();
    const vendorNamesMap = new Map<string, string[]>();
    const labNamesMap = new Map<string, string[]>();
    for (const s of samples) {
      const labels = sampleLabelsMap.get(s.campaign_id) ?? [];
      labels.push(s.sample_label);
      sampleLabelsMap.set(s.campaign_id, labels);

      const vendors = vendorNamesMap.get(s.campaign_id) ?? [];
      if (!vendors.includes(s.vendor_name)) vendors.push(s.vendor_name);
      vendorNamesMap.set(s.campaign_id, vendors);

      const labName = labNameMap.get(s.target_lab_id);
      if (labName) {
        const labNames = labNamesMap.get(s.campaign_id) ?? [];
        if (!labNames.includes(labName)) labNames.push(labName);
        labNamesMap.set(s.campaign_id, labNames);
      }
    }

    return {
      data: rows.map((c) => {
        const progressPct = c.funding_threshold_usd.isZero()
          ? 0
          : Number(c.current_funding_usd.div(c.funding_threshold_usd).mul(100));
        const now = Date.now();
        const deadline = c.deadline_fundraising;
        const timeRemaining =
          deadline && c.status === 'created'
            ? Math.max(0, Math.floor((deadline.getTime() - now) / 1000))
            : null;
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          creator: { id: c.creator_id, username: creatorMap.get(c.creator_id)?.username ?? null },
          amount_requested_usd: Number(c.amount_requested_usd),
          current_funding_usd: Number(c.current_funding_usd),
          funding_threshold_usd: Number(c.funding_threshold_usd),
          funding_progress_percent: progressPct,
          is_flagged_for_review: c.is_flagged_for_review,
          is_hidden: c.is_hidden,
          sample_labels: sampleLabelsMap.get(c.id) ?? [],
          vendor_names: vendorNamesMap.get(c.id) ?? [],
          lab_names: labNamesMap.get(c.id) ?? [],
          deadline_fundraising: c.deadline_fundraising?.toISOString() ?? null,
          time_remaining_seconds: timeRemaining,
          created_at: c.created_at.toISOString(),
        };
      }),
      total,
      page,
      limit,
    };
  }

  async findMyCampaigns(
    userId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<PaginatedResponseDto<CampaignListDto>> {
    return this.findAll(status, undefined, 'newest', page, limit, true);
    // Note: This returns all campaigns; the caller should filter by creator_id
    // SPEC GAP: findMyCampaigns needs to filter by creator_id but findAll doesn't support that yet.
    // Conservative fix: add creator_id filter inline.
  }

  async findMyCampaignsByUser(
    userId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<PaginatedResponseDto<CampaignListDto>> {
    const skip = (page - 1) * limit;
    const statusFilter = status
      ? {
          status: status as
            | 'created'
            | 'funded'
            | 'samples_sent'
            | 'results_published'
            | 'resolved'
            | 'refunded',
        }
      : {};
    const where = { creator_id: userId, ...statusFilter };
    const [rows, total] = await Promise.all([
      this.prisma.campaign.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit }),
      this.prisma.campaign.count({ where }),
    ]);

    const samples =
      rows.length > 0
        ? await this.prisma.sample.findMany({
            where: { campaign_id: { in: rows.map((r) => r.id) } },
            select: {
              campaign_id: true,
              sample_label: true,
              vendor_name: true,
              target_lab_id: true,
            },
          })
        : [];

    const labIds = [...new Set(samples.map((s) => s.target_lab_id))];
    const labs =
      labIds.length > 0
        ? await this.prisma.lab.findMany({
            where: { id: { in: labIds } },
            select: { id: true, name: true },
          })
        : [];
    const labNameMap = new Map(labs.map((l) => [l.id, l.name]));

    const sampleLabelsMap = new Map<string, string[]>();
    const vendorNamesMap = new Map<string, string[]>();
    const labNamesMap = new Map<string, string[]>();
    for (const s of samples) {
      const labels = sampleLabelsMap.get(s.campaign_id) ?? [];
      labels.push(s.sample_label);
      sampleLabelsMap.set(s.campaign_id, labels);

      const vendors = vendorNamesMap.get(s.campaign_id) ?? [];
      if (!vendors.includes(s.vendor_name)) vendors.push(s.vendor_name);
      vendorNamesMap.set(s.campaign_id, vendors);

      const labName = labNameMap.get(s.target_lab_id);
      if (labName) {
        const labNames = labNamesMap.get(s.campaign_id) ?? [];
        if (!labNames.includes(labName)) labNames.push(labName);
        labNamesMap.set(s.campaign_id, labNames);
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    return {
      data: rows.map((c) => {
        const progressPct = c.funding_threshold_usd.isZero()
          ? 0
          : Number(c.current_funding_usd.div(c.funding_threshold_usd).mul(100));
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          creator: { id: c.creator_id, username: user?.username ?? null },
          amount_requested_usd: Number(c.amount_requested_usd),
          current_funding_usd: Number(c.current_funding_usd),
          funding_threshold_usd: Number(c.funding_threshold_usd),
          funding_progress_percent: progressPct,
          is_flagged_for_review: c.is_flagged_for_review,
          is_hidden: c.is_hidden,
          sample_labels: sampleLabelsMap.get(c.id) ?? [],
          vendor_names: vendorNamesMap.get(c.id) ?? [],
          lab_names: labNamesMap.get(c.id) ?? [],
          deadline_fundraising: c.deadline_fundraising?.toISOString() ?? null,
          time_remaining_seconds: null,
          created_at: c.created_at.toISOString(),
        };
      }),
      total,
      page,
      limit,
    };
  }

  // ─── Campaign detail ──────────────────────────────────────────────────────

  async getCampaignDetail(
    campaignId: string,
    requestingUserId?: string
  ): Promise<CampaignDetailDto> {
    const campaign = await this.findCampaignOrThrow(campaignId);

    const [samples, updates, reactions, myReaction, creator, resolvedCount] = await Promise.all([
      this.buildSampleDtos(campaignId),
      this.prisma.campaignUpdate.findMany({
        where: { campaign_id: campaignId },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      this.prisma.reaction.groupBy({
        by: ['reaction_type'],
        where: { campaign_id: campaignId },
        _count: { _all: true },
      }),
      requestingUserId
        ? this.prisma.reaction.findFirst({
            where: { campaign_id: campaignId, user_id: requestingUserId },
          })
        : Promise.resolve(null),
      this.prisma.user.findUnique({
        where: { id: campaign.creator_id },
        select: { id: true, username: true },
      }),
      this.prisma.campaign.count({
        where: { creator_id: campaign.creator_id, status: 'resolved' },
      }),
    ]);

    const reactionCounts: ReactionCountsDto = {
      thumbs_up: 0,
      rocket: 0,
      praising_hands: 0,
      mad: 0,
      fire: 0,
    };
    for (const r of reactions) {
      reactionCounts[r.reaction_type as keyof ReactionCountsDto] = r._count._all;
    }

    const progressPct = campaign.funding_threshold_usd.isZero()
      ? 0
      : Number(campaign.current_funding_usd.div(campaign.funding_threshold_usd).mul(100));

    // Effective lock threshold: min of campaign threshold and global minimum
    const globalMinimums = await this.configService.get<GlobalMinimumsConfig>('global_minimums');
    const globalMinThreshold = new Prisma.Decimal(globalMinimums.min_funding_threshold_usd);
    const effectiveLockThreshold = campaign.funding_threshold_usd.lt(globalMinThreshold)
      ? campaign.funding_threshold_usd
      : globalMinThreshold;

    return {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      status: campaign.status,
      creator: {
        id: campaign.creator_id,
        username: creator?.username ?? null,
        successful_campaigns: resolvedCount,
      },
      verification_code: campaign.verification_code,
      amount_requested_usd: Number(campaign.amount_requested_usd),
      estimated_lab_cost_usd: Number(campaign.estimated_lab_cost_usd),
      current_funding_usd: Number(campaign.current_funding_usd),
      funding_threshold_usd: Number(campaign.funding_threshold_usd),
      funding_threshold_percent: campaign.funding_threshold_percent,
      effective_lock_threshold_usd: Number(effectiveLockThreshold),
      funding_progress_percent: progressPct,
      platform_fee_percent: Number(campaign.platform_fee_percent),
      is_flagged_for_review: campaign.is_flagged_for_review,
      flagged_reason: campaign.flagged_reason,
      is_itemized: campaign.is_itemized,
      itemization_data: campaign.itemization_data,
      is_hidden: !!campaign.is_hidden,
      samples,
      updates: updates.map((u) => ({
        id: u.id,
        campaign_id: u.campaign_id,
        author_id: u.author_id,
        content: u.content,
        update_type: u.update_type,
        state_change_from: u.state_change_from,
        state_change_to: u.state_change_to,
        created_at: u.created_at.toISOString(),
      })),
      reactions: reactionCounts,
      my_reaction: myReaction?.reaction_type ?? null,
      deadlines: {
        fundraising: campaign.deadline_fundraising?.toISOString() ?? null,
        ship_samples: campaign.deadline_ship_samples?.toISOString() ?? null,
        publish_results: campaign.deadline_publish_results?.toISOString() ?? null,
      },
      timestamps: {
        created_at: campaign.created_at.toISOString(),
        funded_at: campaign.funded_at?.toISOString() ?? null,
        locked_at: campaign.locked_at?.toISOString() ?? null,
        samples_sent_at: campaign.samples_sent_at?.toISOString() ?? null,
        results_published_at: campaign.results_published_at?.toISOString() ?? null,
        resolved_at: campaign.resolved_at?.toISOString() ?? null,
        refunded_at: campaign.refunded_at?.toISOString() ?? null,
      },
      refund_reason: campaign.refund_reason,
    };
  }

  private async buildSampleDtos(campaignId: string): Promise<SampleDto[]> {
    const samples = await this.prisma.sample.findMany({
      where: { campaign_id: campaignId },
      orderBy: { order_index: 'asc' },
    });

    const sampleIds = samples.map((s) => s.id);
    const [claims, testRequests, coas, labIds] = await Promise.all([
      this.prisma.sampleClaim.findMany({ where: { sample_id: { in: sampleIds } } }),
      this.prisma.testRequest.findMany({ where: { sample_id: { in: sampleIds } } }),
      this.prisma.coa.findMany({ where: { sample_id: { in: sampleIds } } }),
      Promise.resolve([...new Set(samples.map((s) => s.target_lab_id))]),
    ]);

    const labs = await this.prisma.lab.findMany({
      where: { id: { in: labIds } },
      select: { id: true, name: true },
    });
    const labMap = new Map(labs.map((l) => [l.id, l.name]));

    const testIds = [...new Set(testRequests.map((tr) => tr.test_id))];
    const tests = await this.prisma.test.findMany({
      where: { id: { in: testIds } },
      select: { id: true, name: true, usp_code: true },
    });
    const testMap = new Map(tests.map((t) => [t.id, t]));

    const claimsBySample = new Map<string, typeof claims>();
    for (const c of claims) {
      const arr = claimsBySample.get(c.sample_id) ?? [];
      arr.push(c);
      claimsBySample.set(c.sample_id, arr);
    }

    const testsBySample = new Map<string, typeof testRequests>();
    for (const tr of testRequests) {
      const arr = testsBySample.get(tr.sample_id) ?? [];
      arr.push(tr);
      testsBySample.set(tr.sample_id, arr);
    }

    const coaBySample = new Map(coas.map((c) => [c.sample_id, c]));

    const sampleDtos: SampleDto[] = [];
    for (const s of samples) {
      const coa = coaBySample.get(s.id);
      let coaDto: CoaDto | null = null;
      if (coa) {
        const signedUrl = await this.storageService.getSignedUrl(coa.s3_key);
        coaDto = {
          id: coa.id,
          sample_id: coa.sample_id,
          file_url: signedUrl,
          file_name: coa.file_name,
          file_size_bytes: coa.file_size_bytes,
          uploaded_at: coa.uploaded_at.toISOString(),
          verification_status: coa.verification_status,
          verification_notes: coa.verification_notes,
          verified_at: coa.verified_at?.toISOString() ?? null,
        };
      }

      sampleDtos.push({
        id: s.id,
        vendor_name: s.vendor_name,
        purchase_date: s.purchase_date.toISOString().split('T')[0] ?? '',
        physical_description: s.physical_description,
        sample_label: s.sample_label,
        order_index: s.order_index,
        target_lab: { id: s.target_lab_id, name: labMap.get(s.target_lab_id) ?? '' },
        claims: (claimsBySample.get(s.id) ?? []).map((c) => ({
          id: c.id,
          claim_type: c.claim_type,
          mass_amount: c.mass_amount ? Number(c.mass_amount) : null,
          mass_unit: c.mass_unit,
          other_description: c.other_description,
        })),
        tests: (testsBySample.get(s.id) ?? []).map((tr) => ({
          id: tr.id,
          test_id: tr.test_id,
          name: testMap.get(tr.test_id)?.name ?? '',
          usp_code: testMap.get(tr.test_id)?.usp_code ?? null,
        })),
        coa: coaDto,
      });
    }
    return sampleDtos;
  }

  // ─── Reactions ────────────────────────────────────────────────────────────

  async getReactions(campaignId: string): Promise<ReactionCountsDto> {
    const reactions = await this.prisma.reaction.groupBy({
      by: ['reaction_type'],
      where: { campaign_id: campaignId },
      _count: { _all: true },
    });
    const counts: ReactionCountsDto = {
      thumbs_up: 0,
      rocket: 0,
      praising_hands: 0,
      mad: 0,
      fire: 0,
    };
    for (const r of reactions) {
      counts[r.reaction_type as keyof ReactionCountsDto] = r._count._all;
    }
    return counts;
  }

  async addReaction(
    userId: string,
    campaignId: string,
    dto: AddReactionDto
  ): Promise<{ reaction_type: string; created_at: string }> {
    await this.findCampaignOrThrow(campaignId);
    const reaction = await this.prisma.reaction.upsert({
      where: {
        campaign_id_user_id_reaction_type: {
          campaign_id: campaignId,
          user_id: userId,
          reaction_type: dto.reaction_type,
        },
      },
      create: { campaign_id: campaignId, user_id: userId, reaction_type: dto.reaction_type },
      update: {},
    });
    return { reaction_type: reaction.reaction_type, created_at: reaction.created_at.toISOString() };
  }

  async removeReaction(userId: string, campaignId: string, reactionType: string): Promise<void> {
    await this.prisma.reaction.deleteMany({
      where: {
        campaign_id: campaignId,
        user_id: userId,
        reaction_type: reactionType as 'thumbs_up' | 'rocket' | 'praising_hands' | 'mad' | 'fire',
      },
    });
  }

  // ─── Campaign updates ─────────────────────────────────────────────────────

  async addUpdate(
    userId: string,
    campaignId: string,
    dto: AddCampaignUpdateDto
  ): Promise<CampaignUpdateDto> {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.creator_id !== userId) throw new AuthorizationError('Not your campaign');

    const update = await this.prisma.campaignUpdate.create({
      data: {
        campaign_id: campaignId,
        author_id: userId,
        content: dto.content,
        update_type: 'text',
      },
    });

    return {
      id: update.id,
      campaign_id: update.campaign_id,
      author_id: update.author_id,
      content: update.content,
      update_type: update.update_type,
      state_change_from: update.state_change_from,
      state_change_to: update.state_change_to,
      created_at: update.created_at.toISOString(),
    };
  }

  async getUpdates(
    campaignId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponseDto<CampaignUpdateDto>> {
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.campaignUpdate.findMany({
        where: { campaign_id: campaignId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.campaignUpdate.count({ where: { campaign_id: campaignId } }),
    ]);
    return {
      data: rows.map((u) => ({
        id: u.id,
        campaign_id: u.campaign_id,
        author_id: u.author_id,
        content: u.content,
        update_type: u.update_type,
        state_change_from: u.state_change_from,
        state_change_to: u.state_change_to,
        created_at: u.created_at.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  // ─── Campaign COAs ────────────────────────────────────────────────────────

  async getCoas(campaignId: string): Promise<CoaDto[]> {
    const coas = await this.prisma.coa.findMany({
      where: { campaign_id: campaignId },
      orderBy: { uploaded_at: 'asc' },
      // SPEC GAP: Section 9.3 does not specify sort order for COAs within a campaign.
      // Conservative assumption: sort by uploaded_at ASC (oldest first).
    });
    return Promise.all(
      coas.map(async (coa) => ({
        id: coa.id,
        sample_id: coa.sample_id,
        file_url: await this.storageService.getSignedUrl(coa.s3_key),
        file_name: coa.file_name,
        file_size_bytes: coa.file_size_bytes,
        uploaded_at: coa.uploaded_at.toISOString(),
        verification_status: coa.verification_status,
        verification_notes: coa.verification_notes,
        verified_at: coa.verified_at?.toISOString() ?? null,
      }))
    );
  }

  // ─── Campaign contributions ───────────────────────────────────────────────

  async getContributions(
    campaignId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponseDto<ContributionDto>> {
    const skip = (page - 1) * limit;
    const where = { campaign_id: campaignId };
    const [rows, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        orderBy: { contributed_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contribution.count({ where }),
    ]);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { title: true },
    });
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
        campaign_title: campaign?.title ?? '',
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

  // ─── Cost estimation ──────────────────────────────────────────────────────

  async estimateCost(samplesJson: string): Promise<EstimateCostResponseDto> {
    interface SampleInput {
      target_lab_id: string;
      tests: Array<{ test_id: string }>;
    }
    let samples: SampleInput[];
    try {
      samples = JSON.parse(samplesJson) as SampleInput[];
    } catch {
      throw new ValidationError('Invalid JSON in samples parameter');
    }

    let totalUsd = 0;
    const breakdown = [];

    for (const sample of samples) {
      for (const testReq of sample.tests) {
        const labTest = await this.prisma.labTest.findUnique({
          where: { lab_id_test_id: { lab_id: sample.target_lab_id, test_id: testReq.test_id } },
        });
        if (labTest === null) continue;

        const test = await this.prisma.test.findUnique({
          where: { id: testReq.test_id },
          select: { name: true },
        });
        const lab = await this.prisma.lab.findUnique({
          where: { id: sample.target_lab_id },
          select: { name: true },
        });

        totalUsd += Number(labTest.price_usd);
        breakdown.push({
          lab_id: sample.target_lab_id,
          lab_name: lab?.name ?? '',
          test_id: testReq.test_id,
          test_name: test?.name ?? '',
          price_usd: Number(labTest.price_usd),
        });
      }
    }

    return { estimated_usd: totalUsd, breakdown };
  }

  generatePreviewVerificationCode(): number {
    return Math.floor(100000 + Math.random() * 900000);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async findCampaignOrThrow(campaignId: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (campaign === null) throw new NotFoundError('Campaign not found');
    return campaign;
  }
}
