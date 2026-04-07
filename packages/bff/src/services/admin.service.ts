/**
 * AdminService — admin operations. Spec §9.12 plus §7.17 fee sweep.
 */
import { injectable, inject } from 'tsyringe';
import { Prisma } from '@prisma/client';
import pino from 'pino';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { CampaignService } from './campaign.service';
import { CoaService } from './coa.service';
import { ConfigurationService } from './configuration.service';
import { StorageService } from './storage.service';
import { withdrawalQueue, type WithdrawalJobPayload } from '../utils/queue.util';
import { NotFoundError, ConflictError } from '../utils/errors';
import { env } from '../config/env.config';
import type {
  UserDto,
  AdminBanUserDto,
  AdminClaimDto,
  ConfigurationDto,
  FeeSweepResponseDto,
  AdminFeeSweepDto,
  AdminVerifyCoaDto,
  CoaDto,
  AdminCoaDto,
  CampaignDetailDto,
  PaginatedResponseDto,
  TreasuryDto,
} from 'common';
import type { ClaimType } from '@prisma/client';

const logger = pino({ name: 'AdminService' });

@injectable()
export class AdminService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(CampaignService) private readonly campaignService: CampaignService,
    @inject(CoaService) private readonly coaService: CoaService,
    @inject(ConfigurationService) private readonly configService: ConfigurationService,
    @inject(StorageService) private readonly storageService: StorageService
  ) {}

  // ─── Admin campaign operations ────────────────────────────────────────────

  async getCampaigns(
    status?: string,
    flagged?: boolean,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponseDto<CampaignDetailDto>> {
    const skip = (page - 1) * limit;
    const where: Prisma.CampaignWhereInput = {
      ...(status ? { status: status as Prisma.EnumCampaignStatusFilter } : {}),
      ...(flagged !== undefined ? { is_flagged_for_review: flagged } : {}),
    };

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit }),
      this.prisma.campaign.count({ where }),
    ]);

    const details = await Promise.all(
      campaigns.map((c) => this.campaignService.getCampaignDetail(c.id))
    );

    return { data: details, total, page, limit };
  }

  async getCampaignsByUserId(
    userId: string,
    status?: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponseDto<CampaignDetailDto>> {
    const skip = (page - 1) * limit;
    const where: Prisma.CampaignWhereInput = {
      creator_id: userId,
      ...(status ? { status: status as Prisma.EnumCampaignStatusFilter } : {}),
    };

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit }),
      this.prisma.campaign.count({ where }),
    ]);

    const details = await Promise.all(
      campaigns.map((c) => this.campaignService.getCampaignDetail(c.id))
    );

    return { data: details, total, page, limit };
  }

  async flagCampaign(
    adminUserId: string,
    campaignId: string,
    flagged: boolean,
    reason?: string
  ): Promise<CampaignDetailDto> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (campaign === null) throw new NotFoundError('Campaign not found');

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        is_flagged_for_review: flagged,
        flagged_reason: flagged ? (reason ?? null) : null,
      },
    });

    this.audit.log({
      userId: adminUserId,
      action: flagged ? 'admin.campaign_flagged' : 'admin.campaign_unflagged',
      entityType: 'campaign',
      entityId: campaignId,
      changes: { flagged, reason: reason ?? null },
    });

    return this.campaignService.getCampaignDetail(campaignId);
  }

  async forceRefund(
    adminUserId: string,
    campaignId: string,
    reason: string
  ): Promise<CampaignDetailDto> {
    await this.campaignService.refundContributions(campaignId, reason);
    this.audit.log({
      userId: adminUserId,
      action: 'admin.force_refund',
      entityType: 'campaign',
      entityId: campaignId,
      changes: { reason },
    });
    return this.campaignService.getCampaignDetail(campaignId);
  }

  async hideCampaign(
    adminUserId: string,
    campaignId: string,
    hidden: boolean
  ): Promise<CampaignDetailDto> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (campaign === null) throw new NotFoundError('Campaign not found');

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { is_hidden: hidden },
    });

    this.audit.log({
      userId: adminUserId,
      action: hidden ? 'admin.campaign_hidden' : 'admin.campaign_unhidden',
      entityType: 'campaign',
      entityId: campaignId,
    });

    return this.campaignService.getCampaignDetail(campaignId);
  }

  // ─── User management ──────────────────────────────────────────────────────

  async getUsers(search?: string, page = 1, limit = 20): Promise<PaginatedResponseDto<UserDto>> {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    const dtos = await Promise.all(users.map((u) => this.buildUserDto(u.id)));
    return { data: dtos, total, page, limit };
  }

  // ─── COA verification ────────────────────────────────────────────────────

  async verifyCoa(adminUserId: string, coaId: string, dto: AdminVerifyCoaDto): Promise<CoaDto> {
    return this.coaService.verifyCoa(adminUserId, coaId, dto);
  }

  async listCoas(
    status?: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponseDto<AdminCoaDto>> {
    const skip = (page - 1) * limit;
    const where: Prisma.CoaWhereInput = status
      ? { verification_status: status as Prisma.EnumVerificationStatusFilter }
      : {};

    const coaQuery = {
      where,
      orderBy: { uploaded_at: 'desc' } as const,
      skip,
      take: limit,
      include: {
        campaign: {
          select: {
            title: true,
            verification_code: true,
            creator_id: true,
            creator: { select: { email: true, username: true } },
          },
        },
        sample: {
          include: {
            target_lab: { select: { name: true } },
            testRequests: {
              include: {
                test: { select: { name: true } },
              },
            },
            sampleClaims: {
              where: {
                claim_type: 'mass' as const,
              },
            },
          },
        },
      },
    } satisfies Parameters<typeof this.prisma.coa.findMany>[0];

    type CoaWithIncludes = Prisma.CoaGetPayload<typeof coaQuery>;

    const [coas, total] = await Promise.all([
      this.prisma.coa.findMany(coaQuery) as Promise<CoaWithIncludes[]>,
      this.prisma.coa.count({ where }),
    ]);

    const dtos = await Promise.all(
      coas.map(async (coa: CoaWithIncludes) => {
        const massClaim = coa.sample.sampleClaims[0];
        return {
          id: coa.id,
          sample_id: coa.sample_id,
          campaign_id: coa.campaign_id,
          campaign_title: coa.campaign.title,
          campaign_verification_code: coa.campaign.verification_code,
          sample_label: coa.sample.sample_label,
          file_url: await this.storageService.getSignedUrl(coa.s3_key),
          file_name: coa.file_name,
          file_size_bytes: coa.file_size_bytes,
          uploaded_at: coa.uploaded_at.toISOString(),
          verification_status: coa.verification_status,
          verification_notes: coa.verification_notes,
          verified_at: coa.verified_at?.toISOString() ?? null,
          ocr_text: coa.ocr_text,
          lab_name: coa.sample.target_lab.name,
          test_names: coa.sample.testRequests.map((tr) => tr.test.name),
          sample_mass: massClaim
            ? `${massClaim.mass_amount?.toString() ?? '0'} ${massClaim.mass_unit ?? ''}`
            : null,
          creator_id: coa.campaign.creator_id,
          creator_email: coa.campaign.creator.email,
          creator_username: coa.campaign.creator.username,
          rejection_count: coa.rejection_count,
        };
      })
    );

    return { data: dtos, total, page, limit };
  }

  async runOcr(coaId: string): Promise<CoaDto> {
    return this.coaService.runOcrForAdmin(coaId);
  }

  // ─── User management ──────────────────────────────────────────────────────

  async banUser(adminUserId: string, targetUserId: string, dto: AdminBanUserDto): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (user === null) throw new NotFoundError('User not found');
    if (targetUserId === adminUserId) throw new ConflictError('Cannot ban yourself');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { is_banned: dto.banned },
    });

    if (dto.banned) {
      // Revoke all sessions immediately (spec §9.12)
      await this.prisma.refreshToken.deleteMany({ where: { user_id: targetUserId } });
    }

    this.audit.log({
      userId: adminUserId,
      action: dto.banned ? 'admin.user_banned' : 'admin.user_unbanned',
      entityType: 'user',
      entityId: targetUserId,
      changes: { reason: dto.reason ?? null },
    });

    logger.info({ targetUserId, banned: dto.banned }, 'User ban status updated');

    return this.buildUserDto(targetUserId);
  }

  async manageClaim(
    adminUserId: string,
    targetUserId: string,
    dto: AdminClaimDto
  ): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (user === null) throw new NotFoundError('User not found');

    if (dto.action === 'grant') {
      await this.prisma.userClaim.upsert({
        where: {
          user_id_claim_type: { user_id: targetUserId, claim_type: dto.claim_type as ClaimType },
        },
        create: {
          user_id: targetUserId,
          claim_type: dto.claim_type as ClaimType,
          granted_by_user_id: adminUserId,
        },
        update: { granted_by_user_id: adminUserId },
      });
    } else {
      await this.prisma.userClaim.deleteMany({
        where: { user_id: targetUserId, claim_type: dto.claim_type as ClaimType },
      });
    }

    this.audit.log({
      userId: adminUserId,
      action: `admin.claim_${dto.action}ed`,
      entityType: 'user',
      entityId: targetUserId,
      changes: { claim_type: dto.claim_type, action: dto.action },
    });

    return this.buildUserDto(targetUserId);
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  async getConfig(): Promise<ConfigurationDto[]> {
    return this.configService.getAll();
  }

  async updateConfig(adminUserId: string, key: string, value: unknown): Promise<ConfigurationDto> {
    const result = await this.configService.set(key, value, adminUserId);
    this.audit.log({
      userId: adminUserId,
      action: 'admin.config_updated',
      entityType: 'configuration',
      entityId: key,
      changes: { key, value },
    });
    return result;
  }

  // ─── §7.17 Fee sweep ──────────────────────────────────────────────────────

  async sweepFees(adminUserId: string, dto: AdminFeeSweepDto): Promise<FeeSweepResponseDto> {
    let ledgerTxId = '';

    await this.prisma.$transaction(
      async (tx) => {
        const feeAccount = await tx.feeAccount.findFirst();
        if (feeAccount === null) throw new NotFoundError('Fee account not found');

        // Option B: single unified balance
        const balance = feeAccount.balance;

        if (balance.isZero()) {
          throw new ConflictError('No fees to sweep');
        }

        // Zero out fee account balance
        await tx.feeAccount.update({ where: { id: feeAccount.id }, data: { balance: 0 } });

        const ledgerTx = await tx.ledgerTransaction.create({
          data: {
            transaction_type: 'withdrawal',
            status: 'pending',
            amount: balance,
            currency: 'usdt', // Option B: always USDT on-chain
            from_account_type: 'fee',
            to_account_type: 'external',
            external_address: dto.destination_address,
          },
        });
        ledgerTxId = ledgerTx.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const payload: WithdrawalJobPayload = { ledger_transaction_id: ledgerTxId };
    await withdrawalQueue.add(payload);

    this.audit.log({
      userId: adminUserId,
      action: 'fee.swept',
      entityType: 'fee_account',
      entityId: adminUserId,
      changes: { destination: dto.destination_address },
    });

    return { ledger_transaction_id: ledgerTxId };
  }

  // ─── §new Treasury snapshot ───────────────────────────────────────────────

  async getTreasury(): Promise<TreasuryDto> {
    const [masterWallet, feeAccount, ledgerSum, escrowSum] = await Promise.all([
      this.prisma.masterWallet.findFirst(),
      this.prisma.feeAccount.findFirst(),
      this.prisma.ledgerAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.campaignEscrow.aggregate({ _sum: { balance: true } }),
    ]);

    if (masterWallet === null) {
      throw new NotFoundError('MasterWallet singleton not found — run seed');
    }
    if (feeAccount === null) {
      throw new NotFoundError('FeeAccount singleton not found — run seed');
    }

    // Pending fee estimate: sum over all active campaign escrows × each campaign's
    // platform_fee_percent baked at creation time. Computed at read time — no new ledger rows.
    const activeEscrows = await this.prisma.campaignEscrow.findMany({
      where: {
        campaign: {
          status: { in: ['created', 'funded', 'samples_sent', 'results_published'] },
        },
      },
      select: {
        balance: true,
        campaign: { select: { platform_fee_percent: true } },
      },
    });

    const pendingFeesEstimate = activeEscrows.reduce((acc, escrow) => {
      const fee = Number(escrow.balance) * (Number(escrow.campaign.platform_fee_percent) / 100);
      return acc + fee;
    }, 0);

    const usdcBalance = Number(masterWallet.usdc_balance);
    const usdtBalance = Number(masterWallet.usdt_balance);
    const feeBalance = Number(feeAccount.balance);

    return {
      master_wallet: {
        public_key: env.MASTER_WALLET_PUBLIC_KEY,
        usdc_balance: usdcBalance,
        usdt_balance: usdtBalance,
        total_balance: usdcBalance + usdtBalance,
        last_synced_at: masterWallet.updated_at.toISOString(),
      },
      fee_account: {
        balance: feeBalance,
        pending_fees_estimate: pendingFeesEstimate,
        total_fees_exposure: feeBalance + pendingFeesEstimate,
        available_to_sweep: feeBalance > 0,
      },
      ledger: {
        total_user_balances: Number(ledgerSum._sum?.balance ?? 0),
        total_escrow_balances: Number(escrowSum._sum?.balance ?? 0),
      },
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async buildUserDto(userId: string): Promise<UserDto> {
    const [user, claims, contribStats] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.userClaim.findMany({ where: { user_id: userId } }),
      this.prisma.contribution.aggregate({
        where: { contributor_id: userId, status: 'completed' },
        _sum: { amount_usd: true },
      }),
    ]);

    const [resolvedCampaigns, refundedCampaigns, campaignCount] = await Promise.all([
      this.prisma.campaign.count({ where: { creator_id: userId, status: 'resolved' } }),
      this.prisma.campaign.count({ where: { creator_id: userId, status: 'refunded' } }),
      this.prisma.campaign.count({ where: { creator_id: userId } }),
    ]);

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      is_banned: user.is_banned,
      email_verified: user.email_verified,
      claims: claims.map((c) => c.claim_type as import('common').ClaimType),
      stats: {
        total_contributed_usd: Number(contribStats._sum.amount_usd ?? 0),
        campaigns_created: campaignCount,
        campaigns_successful: resolvedCampaigns,
        campaigns_refunded: refundedCampaigns,
      },
      created_at: user.created_at.toISOString(),
    };
  }
}
