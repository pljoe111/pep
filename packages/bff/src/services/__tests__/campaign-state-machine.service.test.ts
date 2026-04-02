/**
 * CampaignService state-machine integration tests — spec §7.10–§7.15, §3.3.
 * Option B: single unified balance.
 *
 * Covers:
 *   - resolveCampaign: fee math (ROUND_DOWN), escrow zeroing, creator payout, fee account credit
 *   - refundContributions: money conservation, contributor balance restoration, escrow zeroing
 *   - All ConflictError invalid-transition cases (spec §3.3)
 *
 * Real Postgres. Mocks: queue.util, NotificationService, AuditService, StorageService.
 * All Decimal comparisons use .toString() — never .toNumber().
 */

// Hoisted by Vitest — prevents Bull from connecting to Redis at module load time.
vi.mock('../../utils/queue.util', () => ({
  withdrawalQueue: { add: vi.fn().mockResolvedValue(undefined) },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined) },
  ocrQueue: { add: vi.fn().mockResolvedValue(undefined) },
  depositScannerQueue: { add: vi.fn().mockResolvedValue(undefined) },
  deadlineMonitorQueue: { add: vi.fn().mockResolvedValue(undefined) },
  reconciliationQueue: { add: vi.fn().mockResolvedValue(undefined) },
  refreshTokenCleanupQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import type { CampaignService } from '../campaign.service';
import type { PrismaService } from '../prisma.service';
import type { AuditService } from '../audit.service';
import type { NotificationService } from '../notification.service';
import type { ConfigurationService } from '../configuration.service';
import type { StorageService } from '../storage.service';

// ─── Shared state ─────────────────────────────────────────────────────────────

let prisma!: PrismaService;
let service!: CampaignService;
let feeAccountId!: string;

const createdUserIds: string[] = [];
const createdCampaignIds: string[] = [];

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/test';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters!!';
  process.env.USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  process.env.USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  process.env.MASTER_WALLET_PUBLIC_KEY = '11111111111111111111111111111111';
  process.env.MASTER_WALLET_PRIVATE_KEY =
    '5NemXetH19TAcuBd4ABz3URRDmxRPNrDDXFfgvzPT6KZkxGNv6kD3ZKuvjpgBN8GXbVCF8TkU9tMZPU6LEKF5qes';
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);

  const { CampaignService: CS } = await import('../campaign.service');
  const { PrismaService: PS } = await import('../prisma.service');

  prisma = new PS();

  // Record the seeded fee account ID so tests can assert on it
  const feeAccount = await prisma.feeAccount.findFirst();
  if (!feeAccount) throw new Error('FeeAccount row missing — run DB seed first');
  feeAccountId = feeAccount.id;

  const auditMock = { log: vi.fn() } as unknown as AuditService;
  const notifMock = {
    send: vi.fn().mockResolvedValue(undefined),
    sendToAllContributors: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
  const configMock = {
    get: vi.fn().mockResolvedValue({ value: 5 }),
  } as unknown as ConfigurationService;
  const storageMock = {
    getSignedUrl: vi.fn().mockResolvedValue('https://signed.url/placeholder'),
  } as unknown as StorageService;

  service = new CS(prisma, auditMock, notifMock, configMock, storageMock);
});

// Reset fee account balances before each test so assertions are absolute not relative.
beforeEach(async () => {
  // Option B: single balance field
  await prisma.feeAccount.updateMany({ data: { balance: 0 } });
});

afterEach(async () => {
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
  // Reset fee account after each test that might have modified it
  await prisma.feeAccount.updateMany({ data: { balance: 0 } });
});

afterAll(async () => {
  await prisma.disconnect();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _codeSeq = 300_000;

async function seedUser(): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `sm-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: true,
    },
  });
  // Option B: single balance field
  await prisma.ledgerAccount.create({ data: { user_id: u.id } });
  createdUserIds.push(u.id);
  return u.id;
}

async function seedCampaign(
  creatorId: string,
  status: 'created' | 'funded' | 'samples_sent' | 'results_published' | 'resolved' | 'refunded',
  platformFeePercent = 5
): Promise<string> {
  _codeSeq += 1;
  const c = await prisma.campaign.create({
    data: {
      creator_id: creatorId,
      verification_code: _codeSeq,
      title: `SM Test ${_codeSeq}`,
      description: 'State machine integration test',
      amount_requested_usd: 5000,
      funding_threshold_percent: 50,
      funding_threshold_usd: 500,
      current_funding_usd: 0,
      estimated_lab_cost_usd: 2000,
      platform_fee_percent: platformFeePercent,
      status,
      is_flagged_for_review: false,
      deadline_fundraising: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.campaignEscrow.create({ data: { campaign_id: c.id } });
  createdCampaignIds.push(c.id);
  return c.id;
}

// ─── Tests: business flows with real money ───────────────────────────────────

describe('CampaignService.resolveCampaign', () => {
  it('distributes payout and fee with correct Decimal math, zeroes escrow, writes ledger txns', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'results_published', 5);

    // Seed escrow with 200 (unified balance)
    await prisma.campaignEscrow.update({
      where: { campaign_id: campaignId },
      data: { balance: 200 },
    });

    await service.resolveCampaign(campaignId);

    // Fee = 200 × 5% = 10.000000 (ROUND_DOWN); Payout = 190.000000

    // Creator balance credited with payout
    const creatorAccount = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { user_id: creatorId },
    });
    expect(creatorAccount.balance.toString()).toBe('190');

    // Escrow zeroed
    const escrow = await prisma.campaignEscrow.findUniqueOrThrow({
      where: { campaign_id: campaignId },
    });
    expect(escrow.balance.toString()).toBe('0');

    // Fee account credited
    const feeAccount = await prisma.feeAccount.findUniqueOrThrow({ where: { id: feeAccountId } });
    expect(feeAccount.balance.toString()).toBe('10');

    // Payout ledger transaction: campaign → creator (currency = usdt, Option B)
    const payoutTxns = await prisma.ledgerTransaction.findMany({
      where: { to_account_id: creatorId, transaction_type: 'payout' },
    });
    expect(payoutTxns).toHaveLength(1);
    expect(payoutTxns[0].amount.toString()).toBe('190');
    expect(payoutTxns[0].currency).toBe('usdt'); // Option B: always USDT
    expect(payoutTxns[0].from_account_type).toBe('campaign');
    expect(payoutTxns[0].from_account_id).toBe(campaignId);
    expect(payoutTxns[0].status).toBe('completed');

    // Fee ledger transaction: campaign → fee account
    const feeTxns = await prisma.ledgerTransaction.findMany({
      where: { from_account_id: campaignId, transaction_type: 'fee' },
    });
    expect(feeTxns).toHaveLength(1);
    expect(feeTxns[0].amount.toString()).toBe('10');
    expect(feeTxns[0].currency).toBe('usdt');
    expect(feeTxns[0].to_account_type).toBe('fee');
    expect(feeTxns[0].status).toBe('completed');

    // Campaign marked resolved
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.status).toBe('resolved');
    expect(campaign.resolved_at).not.toBeNull();
  });
});

describe('CampaignService.refundContributions', () => {
  it('restores contributor balances, zeroes escrow, marks contributions refunded (money conservation)', async () => {
    const creatorId = await seedUser();
    const contributorA = await seedUser();
    const contributorB = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'funded');

    // Seed starting balances
    await prisma.ledgerAccount.update({
      where: { user_id: contributorA },
      data: { balance: 25 },
    });
    await prisma.ledgerAccount.update({
      where: { user_id: contributorB },
      data: { balance: 20 },
    });

    // Seed unified escrow balance: 75 + 30 = 105
    await prisma.campaignEscrow.update({
      where: { campaign_id: campaignId },
      data: { balance: 105 },
    });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { current_funding_usd: 105 },
    });

    // Seed contribution rows (written directly to DB — not via service)
    const contribA = await prisma.contribution.create({
      data: {
        campaign_id: campaignId,
        contributor_id: contributorA,
        amount_usd: 75,
        currency: 'usdc', // currency still tracked
        status: 'completed',
      },
    });
    const contribB = await prisma.contribution.create({
      data: {
        campaign_id: campaignId,
        contributor_id: contributorB,
        amount_usd: 30,
        currency: 'usdt', // currency still tracked
        status: 'completed',
      },
    });

    await service.refundContributions(campaignId, 'test refund reason');

    // A balance restored: 25 + 75 = 100
    const accountA = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { user_id: contributorA },
    });
    expect(accountA.balance.toString()).toBe('100');

    // B balance restored: 20 + 30 = 50
    const accountB = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { user_id: contributorB },
    });
    expect(accountB.balance.toString()).toBe('50');

    // Escrow zeroed
    const escrow = await prisma.campaignEscrow.findUniqueOrThrow({
      where: { campaign_id: campaignId },
    });
    expect(escrow.balance.toString()).toBe('0');

    // Both contributions marked refunded
    const updatedA = await prisma.contribution.findUniqueOrThrow({ where: { id: contribA.id } });
    const updatedB = await prisma.contribution.findUniqueOrThrow({ where: { id: contribB.id } });
    expect(updatedA.status).toBe('refunded');
    expect(updatedA.refunded_at).not.toBeNull();
    expect(updatedB.status).toBe('refunded');
    expect(updatedB.refunded_at).not.toBeNull();

    // Campaign current_funding_usd zeroed and status=refunded
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.status).toBe('refunded');
    expect(campaign.current_funding_usd.toString()).toBe('0');
    expect(campaign.refund_reason).toBe('test refund reason');

    // Two refund ledger transactions (one per contribution)
    const refundTxns = await prisma.ledgerTransaction.findMany({
      where: { from_account_id: campaignId, transaction_type: 'refund' },
    });
    expect(refundTxns).toHaveLength(2);
  });

  it('throws ConflictError when campaign is already resolved', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'resolved');
    await expect(service.refundContributions(campaignId, 'reason')).rejects.toMatchObject({
      name: 'ConflictError',
    });
  });

  it('throws ConflictError when campaign is already refunded', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'refunded');
    await expect(service.refundContributions(campaignId, 'reason')).rejects.toMatchObject({
      name: 'ConflictError',
    });
  });
});

// ─── Tests: invalid state transitions (spec §3.3) ────────────────────────────

describe('CampaignService invalid state transitions', () => {
  it('resolveCampaign throws ConflictError when status is not results_published', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'funded');
    await expect(service.resolveCampaign(campaignId)).rejects.toMatchObject({
      name: 'ConflictError',
    });
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(c.status).toBe('funded'); // unchanged
  });

  it('lockCampaign throws ConflictError when status is not created', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'funded');
    await expect(service.lockCampaign(creatorId, campaignId)).rejects.toMatchObject({
      name: 'ConflictError',
    });
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(c.status).toBe('funded'); // unchanged
  });

  it('lockCampaign throws ConflictError when funding threshold not yet reached', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'created');
    // current_funding_usd = 0, funding_threshold_usd = 500 → threshold not met
    await expect(service.lockCampaign(creatorId, campaignId)).rejects.toMatchObject({
      name: 'ConflictError',
    });
  });

  it('shipSamples throws ConflictError when status is not funded', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'created');
    await expect(service.shipSamples(creatorId, campaignId)).rejects.toMatchObject({
      name: 'ConflictError',
    });
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(c.status).toBe('created'); // unchanged
  });

  it('deleteCampaign throws ConflictError when status is not created', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'funded');
    await expect(service.deleteCampaign(creatorId, campaignId)).rejects.toMatchObject({
      name: 'ConflictError',
    });
    // Campaign must still exist (not deleted)
    const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
    expect(c).not.toBeNull();
  });

  it('deleteCampaign throws ConflictError when campaign has contributions (current_funding_usd > 0)', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'created');
    // Simulate existing contributions by setting current_funding_usd directly
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { current_funding_usd: 50 },
    });
    await expect(service.deleteCampaign(creatorId, campaignId)).rejects.toMatchObject({
      name: 'ConflictError',
    });
  });

  it('updateCampaign throws ConflictError when status is not created', async () => {
    const creatorId = await seedUser();
    const campaignId = await seedCampaign(creatorId, 'funded');
    await expect(
      service.updateCampaign(creatorId, campaignId, { title: 'New Title' })
    ).rejects.toMatchObject({ name: 'ConflictError' });
  });
});
