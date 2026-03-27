/**
 * ContributionService integration tests — spec §7.9.
 *
 * Real Postgres (postgresql://postgres:password@localhost:5432/test).
 * Mocks: queue.util (Bull/Redis), NotificationService, AuditService, ConfigurationService.
 * Every test writes setup state directly to DB; afterEach cleans up.
 * All Decimal comparisons use .toString() — never .toNumber().
 */

// vi.mock is hoisted before imports by Vitest — prevents Bull from connecting to Redis.
vi.mock('../../utils/queue.util', () => ({
  withdrawalQueue: { add: vi.fn().mockResolvedValue(undefined) },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined) },
  ocrQueue: { add: vi.fn().mockResolvedValue(undefined) },
  depositScannerQueue: { add: vi.fn().mockResolvedValue(undefined) },
  deadlineMonitorQueue: { add: vi.fn().mockResolvedValue(undefined) },
  reconciliationQueue: { add: vi.fn().mockResolvedValue(undefined) },
  refreshTokenCleanupQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import type { ContributionService } from '../contribution.service';
import type { PrismaService } from '../prisma.service';
import type { AuditService } from '../audit.service';
import type { NotificationService } from '../notification.service';
import type { ConfigurationService, GlobalMinimumsConfig } from '../configuration.service';
import type { ContributeDto } from 'common';

// ─── Shared state ─────────────────────────────────────────────────────────────

let prisma!: PrismaService;
let service!: ContributionService;

/** IDs created per-test — cleared and deleted in afterEach */
const createdUserIds: string[] = [];
const createdCampaignIds: string[] = [];

const mockGlobalMinimums: GlobalMinimumsConfig = {
  min_contribution_usd: 1,
  min_funding_threshold_usd: 100,
  min_funding_threshold_percent: 5,
  min_withdrawal_usd: 1,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Set env vars BEFORE any module that triggers env.config.ts validation is imported.
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/test';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters!!';
  process.env.USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  process.env.USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  process.env.MASTER_WALLET_PUBLIC_KEY = '11111111111111111111111111111111';
  process.env.MASTER_WALLET_PRIVATE_KEY =
    '5NemXetH19TAcuBd4ABz3URRDmxRPNrDDXFfgvzPT6KZkxGNv6kD3ZKuvjpgBN8GXbVCF8TkU9tMZPU6LEKF5qes';
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);

  // Dynamic import: deferred until env vars are set so env.config.ts validates cleanly.
  const { ContributionService: CS } = await import('../contribution.service');
  const { PrismaService: PS } = await import('../prisma.service');

  prisma = new PS();

  const auditMock = { log: vi.fn() } as unknown as AuditService;
  const notifMock = {
    send: vi.fn().mockResolvedValue(undefined),
    sendToAllContributors: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
  const configMock = {
    get: vi.fn().mockResolvedValue(mockGlobalMinimums),
  } as unknown as ConfigurationService;

  service = new CS(prisma, auditMock, notifMock, configMock);
});

afterEach(async () => {
  // Delete in safe order (no FK constraints enforced in this schema).
  if (createdCampaignIds.length > 0) {
    await prisma.ledgerTransaction.deleteMany({
      where: {
        OR: [
          { from_account_id: { in: createdCampaignIds } },
          { to_account_id: { in: createdCampaignIds } },
        ],
      },
    });
    await prisma.campaignUpdate.deleteMany({
      where: { campaign_id: { in: createdCampaignIds } },
    });
    await prisma.contribution.deleteMany({
      where: { campaign_id: { in: createdCampaignIds } },
    });
    await prisma.campaignEscrow.deleteMany({
      where: { campaign_id: { in: createdCampaignIds } },
    });
    await prisma.campaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
    createdCampaignIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.ledgerTransaction.deleteMany({
      where: {
        OR: [
          { from_account_id: { in: createdUserIds } },
          { to_account_id: { in: createdUserIds } },
        ],
      },
    });
    await prisma.ledgerAccount.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

afterAll(async () => {
  await prisma.disconnect();
});

// ─── Helpers (write directly to DB — never call service methods for setup) ────

let _codeSeq = 200_000; // High range to avoid collision with real data

async function seedUser(opts?: { banned?: boolean; unverified?: boolean }): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `contrib-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: opts?.unverified !== true,
      is_banned: opts?.banned === true,
    },
  });
  await prisma.ledgerAccount.create({ data: { user_id: u.id } });
  createdUserIds.push(u.id);
  return u.id;
}

async function seedCampaign(
  creatorId: string,
  thresholdUsd: number,
  status: 'created' | 'funded' | 'resolved' | 'refunded' | 'samples_sent' = 'created'
): Promise<string> {
  _codeSeq += 1;
  const c = await prisma.campaign.create({
    data: {
      creator_id: creatorId,
      verification_code: _codeSeq,
      title: `Contrib Test ${_codeSeq}`,
      description: 'Integration test campaign',
      amount_requested_usd: 5000,
      funding_threshold_percent: 50,
      funding_threshold_usd: thresholdUsd,
      current_funding_usd: 0,
      estimated_lab_cost_usd: 2000,
      platform_fee_percent: 5,
      status,
      is_flagged_for_review: false,
      deadline_fundraising: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.campaignEscrow.create({ data: { campaign_id: c.id } });
  createdCampaignIds.push(c.id);
  return c.id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContributionService.contribute', () => {
  it('debits user balance, credits escrow, persists contribution and ledger tx for USDC', async () => {
    const creatorId = await seedUser();
    const contributorId = await seedUser();
    await prisma.ledgerAccount.update({
      where: { user_id: contributorId },
      data: { balance_usdc: 200 },
    });
    const campaignId = await seedCampaign(creatorId, 500);

    const dto: ContributeDto = { amount: 75, currency: 'usdc' };
    await service.contribute(contributorId, campaignId, dto, true, false);

    // Assert ledger account debited
    const account = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { user_id: contributorId },
    });
    expect(account.balance_usdc.toString()).toBe('125');

    // Assert escrow credited (only USDC field changes)
    const escrow = await prisma.campaignEscrow.findUniqueOrThrow({
      where: { campaign_id: campaignId },
    });
    expect(escrow.balance_usdc.toString()).toBe('75');
    expect(escrow.balance_usdt.toString()).toBe('0');

    // Assert campaign current_funding_usd updated
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.current_funding_usd.toString()).toBe('75');

    // Assert contribution row written
    const contributions = await prisma.contribution.findMany({
      where: { campaign_id: campaignId },
    });
    expect(contributions).toHaveLength(1);
    expect(contributions[0].amount_usd.toString()).toBe('75');
    expect(contributions[0].currency).toBe('usdc');
    expect(contributions[0].status).toBe('completed');
    expect(contributions[0].contributor_id).toBe(contributorId);

    // Assert ledger transaction written
    const txns = await prisma.ledgerTransaction.findMany({
      where: { to_account_id: campaignId, transaction_type: 'contribution' },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].amount.toString()).toBe('75');
    expect(txns[0].currency).toBe('usdc');
    expect(txns[0].from_account_type).toBe('user');
    expect(txns[0].from_account_id).toBe(contributorId);
    expect(txns[0].to_account_type).toBe('campaign');
    expect(txns[0].to_account_id).toBe(campaignId);
    expect(txns[0].status).toBe('completed');
  });

  it('debits user USDT balance and credits USDT escrow field', async () => {
    const creatorId = await seedUser();
    const contributorId = await seedUser();
    await prisma.ledgerAccount.update({
      where: { user_id: contributorId },
      data: { balance_usdt: 100 },
    });
    const campaignId = await seedCampaign(creatorId, 500);

    const dto: ContributeDto = { amount: 40, currency: 'usdt' };
    await service.contribute(contributorId, campaignId, dto, true, false);

    const account = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { user_id: contributorId },
    });
    expect(account.balance_usdt.toString()).toBe('60');
    expect(account.balance_usdc.toString()).toBe('0'); // USDC untouched

    const escrow = await prisma.campaignEscrow.findUniqueOrThrow({
      where: { campaign_id: campaignId },
    });
    expect(escrow.balance_usdt.toString()).toBe('40');
    expect(escrow.balance_usdc.toString()).toBe('0'); // USDC untouched

    const contributions = await prisma.contribution.findMany({
      where: { campaign_id: campaignId },
    });
    expect(contributions).toHaveLength(1);
    expect(contributions[0].currency).toBe('usdt');
    expect(contributions[0].amount_usd.toString()).toBe('40');
  });

  it('auto-advances campaign to funded when contribution crosses the threshold', async () => {
    const creatorId = await seedUser();
    const contributorId = await seedUser();
    await prisma.ledgerAccount.update({
      where: { user_id: contributorId },
      data: { balance_usdc: 50 },
    });
    // Threshold = 100; seed campaign with current_funding = 90 (just below threshold)
    const campaignId = await seedCampaign(creatorId, 100);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { current_funding_usd: 90 },
    });
    await prisma.campaignEscrow.update({
      where: { campaign_id: campaignId },
      data: { balance_usdc: 90 },
    });
    // Seed an existing contribution row representing the 90 already in escrow
    await prisma.contribution.create({
      data: {
        campaign_id: campaignId,
        contributor_id: creatorId, // different user, so contributorId contribution is the crossing one
        amount_usd: 90,
        currency: 'usdc',
        status: 'completed',
      },
    });

    // This 20-USDC contribution pushes current_funding to 110 ≥ threshold 100
    const dto: ContributeDto = { amount: 20, currency: 'usdc' };
    await service.contribute(contributorId, campaignId, dto, true, false);

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.status).toBe('funded');
    expect(campaign.funded_at).not.toBeNull();
    expect(campaign.deadline_ship_samples).not.toBeNull();
    expect(campaign.current_funding_usd.toString()).toBe('110');

    // CampaignUpdate state-change row
    const updates = await prisma.campaignUpdate.findMany({
      where: { campaign_id: campaignId, state_change_to: 'funded' },
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].state_change_from).toBe('created');
  });

  it('throws AuthorizationError when account is banned', async () => {
    const creatorId = await seedUser();
    const bannedId = await seedUser({ banned: true });
    const campaignId = await seedCampaign(creatorId, 500);

    const dto: ContributeDto = { amount: 10, currency: 'usdc' };
    await expect(service.contribute(bannedId, campaignId, dto, true, true)).rejects.toMatchObject({
      name: 'AuthorizationError',
    });
  });

  it('throws AuthorizationError when email is not verified', async () => {
    const creatorId = await seedUser();
    const unverifiedId = await seedUser({ unverified: true });
    const campaignId = await seedCampaign(creatorId, 500);

    const dto: ContributeDto = { amount: 10, currency: 'usdc' };
    await expect(
      service.contribute(unverifiedId, campaignId, dto, false, false)
    ).rejects.toMatchObject({ name: 'AuthorizationError' });
  });

  it('throws ConflictError when creator tries to contribute to own campaign', async () => {
    const creatorId = await seedUser();
    await prisma.ledgerAccount.update({
      where: { user_id: creatorId },
      data: { balance_usdc: 100 },
    });
    const campaignId = await seedCampaign(creatorId, 500);

    const dto: ContributeDto = { amount: 10, currency: 'usdc' };
    await expect(service.contribute(creatorId, campaignId, dto, true, false)).rejects.toMatchObject(
      { name: 'ConflictError' }
    );
  });

  it('throws ConflictError when campaign is not accepting contributions', async () => {
    const creatorId = await seedUser();
    const contributorId = await seedUser();
    await prisma.ledgerAccount.update({
      where: { user_id: contributorId },
      data: { balance_usdc: 100 },
    });
    // Campaign in 'resolved' status — closed to contributions
    const campaignId = await seedCampaign(creatorId, 500, 'resolved');

    const dto: ContributeDto = { amount: 10, currency: 'usdc' };
    await expect(
      service.contribute(contributorId, campaignId, dto, true, false)
    ).rejects.toMatchObject({ name: 'ConflictError' });
  });

  it('throws ValidationError when amount is below global minimum', async () => {
    const creatorId = await seedUser();
    const contributorId = await seedUser();
    await prisma.ledgerAccount.update({
      where: { user_id: contributorId },
      data: { balance_usdc: 100 },
    });
    const campaignId = await seedCampaign(creatorId, 500);

    // min_contribution_usd in mock = 1; amount 0.5 is below minimum
    const dto: ContributeDto = { amount: 0.5, currency: 'usdc' };
    await expect(
      service.contribute(contributorId, campaignId, dto, true, false)
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('throws InsufficientBalanceError when user balance is lower than amount', async () => {
    const creatorId = await seedUser();
    const contributorId = await seedUser();
    // Balance = 5; attempting to contribute 20
    await prisma.ledgerAccount.update({
      where: { user_id: contributorId },
      data: { balance_usdc: 5 },
    });
    const campaignId = await seedCampaign(creatorId, 500);

    const dto: ContributeDto = { amount: 20, currency: 'usdc' };
    await expect(
      service.contribute(contributorId, campaignId, dto, true, false)
    ).rejects.toMatchObject({ name: 'InsufficientBalanceError' });
  });
});
