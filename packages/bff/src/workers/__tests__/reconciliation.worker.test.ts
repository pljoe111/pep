/**
 * Reconciliation Worker integration tests — spec §5 (ON-OFF-RAMP-TEST-PLAN.md).
 *
 * Strategy (Option A from §7):
 *   - Bull reconciliation queue is mocked; the process() callback is captured.
 *   - SolanaService.getTokenBalance is mocked (on-chain balance supplied via mock).
 *   - EmailService.sendOperatorAlert is mocked — tested for call/no-call.
 *   - PrismaService is real — connects to PostgreSQL `test` database.
 *
 * Tolerance threshold: 0.000001 (1 micro-unit) — defined in reconciliation.worker.ts.
 *
 * All monetary assertions use .toString() — never .toNumber() (coding rules §8.4).
 */

// ─── Captured Bull callback ────────────────────────────────────────────────────
let reconcileTick: (() => Promise<void>) | null = null;

// ─── Module-level mock objects ─────────────────────────────────────────────────
const mockSolana = {
  getSignaturesForAddress: vi.fn(),
  getParsedTransaction: vi.fn(),
  sweepDeposit: vi.fn(),
  executeWithdrawal: vi.fn(),
  getTokenBalance: vi.fn(),
  getTransaction: vi.fn(),
  getSolBalance: vi.fn(),
};

const mockEmail = {
  send: vi.fn().mockResolvedValue(undefined),
  sendOperatorAlert: vi.fn().mockResolvedValue(undefined),
};

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock('../../utils/queue.util', () => ({
  reconciliationQueue: {
    add: vi.fn().mockResolvedValue(undefined),
    process: vi.fn().mockImplementation((_concurrency: number, cb: () => Promise<void>) => {
      reconcileTick = cb;
    }),
  },
  withdrawalQueue: { add: vi.fn().mockResolvedValue(undefined) },
  depositScannerQueue: { add: vi.fn().mockResolvedValue(undefined) },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined) },
  ocrQueue: { add: vi.fn().mockResolvedValue(undefined) },
  deadlineMonitorQueue: { add: vi.fn().mockResolvedValue(undefined) },
  refreshTokenCleanupQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';

import type { PrismaService } from '../../services/prisma.service';

// ─── Shared state ─────────────────────────────────────────────────────────────
let prisma!: PrismaService;

/** All user + escrow row IDs created during a test — cleaned up in afterEach. */
const createdUserIds: string[] = [];
const createdCampaignIds: string[] = [];

// ─── Env + container bootstrap ────────────────────────────────────────────────
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
  process.env.SOLANA_RPC_URL = 'http://localhost:8899';
  process.env.SOLANA_NETWORK = 'testnet';
  process.env.REDIS_URL = 'redis://localhost:6379';

  vi.resetModules();

  const { PrismaService: PS } = await import('../../services/prisma.service');
  const { SolanaService: SS } = await import('../../services/solana.service');
  const { EmailService: ES } = await import('../../services/email.service');
  const { container } = await import('../../container');

  prisma = new PS();

  container.registerInstance(SS, mockSolana as unknown as InstanceType<typeof SS>);
  container.registerInstance(ES, mockEmail as unknown as InstanceType<typeof ES>);
  container.registerInstance(PS, prisma);

  const { startReconciliationWorker } = await import('../reconciliation.worker');
  startReconciliationWorker(); // captures reconcileTick
});

afterEach(async () => {
  // Remove test campaign escrow and campaign rows
  if (createdCampaignIds.length > 0) {
    await prisma.campaignEscrow.deleteMany({ where: { campaign_id: { in: createdCampaignIds } } });
    await prisma.campaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
    createdCampaignIds.length = 0;
  }
  // Remove test ledger accounts and users
  if (createdUserIds.length > 0) {
    await prisma.ledgerAccount.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
  // Reset fee account back to zeroes so tests are independent
  await prisma.feeAccount.updateMany({ data: { balance_usdc: 0, balance_usdt: 0 } });

  vi.clearAllMocks();
  mockEmail.sendOperatorAlert.mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.disconnect();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates ledger accounts summing to the requested totals.
 * Each call appends one user with the given balances.
 */
async function seedLedgerAccount(usdc: number, usdt: number): Promise<void> {
  const user = await prisma.user.create({
    data: {
      email: `recon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: true,
    },
  });
  await prisma.ledgerAccount.create({
    data: { user_id: user.id, balance_usdc: usdc, balance_usdt: usdt },
  });
  createdUserIds.push(user.id);
}

/**
 * Creates a minimal Campaign + CampaignEscrow pair with the given balances.
 * A Campaign row is required due to FK constraints on campaign_escrow.
 */
async function seedCampaignEscrow(usdc: number, usdt: number): Promise<void> {
  // We need a creator user for the campaign FK
  const creator = await prisma.user.create({
    data: {
      email: `recon-creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: true,
    },
  });
  createdUserIds.push(creator.id);

  const campaign = await prisma.campaign.create({
    data: {
      creator_id: creator.id,
      // verification_code must be unique — use a random large int to avoid collisions
      verification_code: Math.floor(Math.random() * 9_000_000) + 1_000_000,
      title: 'Recon Test Campaign',
      description: 'Reconciliation test data',
      amount_requested_usd: 1000,
      funding_threshold_percent: 10,
      funding_threshold_usd: 100,
      estimated_lab_cost_usd: 800,
      platform_fee_percent: 5,
      deadline_fundraising: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  createdCampaignIds.push(campaign.id);

  await prisma.campaignEscrow.create({
    data: { campaign_id: campaign.id, balance_usdc: usdc, balance_usdt: usdt },
  });
}

/**
 * Sets the (single) FeeAccount row balances.
 * Creates the row if it does not exist (migration may not have seeded it in test DB).
 */
async function setFeeBalance(usdc: number, usdt: number): Promise<void> {
  const existing = await prisma.feeAccount.findFirst();
  if (existing !== null) {
    await prisma.feeAccount.update({
      where: { id: existing.id },
      data: { balance_usdc: usdc, balance_usdt: usdt },
    });
  } else {
    await prisma.feeAccount.create({ data: { balance_usdc: usdc, balance_usdt: usdt } });
  }
}

/**
 * mockSolana.getTokenBalance is called with (masterPubkey, currency).
 * rawUnits = displayUnits * 1_000_000 (matching how SolanaService converts).
 */
function setOnchainBalance(usdcDisplayUnits: number, usdtDisplayUnits: number): void {
  mockSolana.getTokenBalance.mockImplementation((_addr: string, currency: 'usdc' | 'usdt') =>
    Promise.resolve(
      currency === 'usdc' ? usdcDisplayUnits * 1_000_000 : usdtDisplayUnits * 1_000_000
    )
  );
}

// ─── §5.1 — Balanced state: no alert sent ─────────────────────────────────────
describe('ReconciliationWorker §5.1 — Balanced state', () => {
  it('does not call sendOperatorAlert when internal total matches on-chain balance', async () => {
    // Internal: 150 ledger + 50 escrow + 0 fee = 200
    await seedLedgerAccount(150, 0);
    await seedCampaignEscrow(50, 0);
    await setFeeBalance(0, 0);

    // On-chain: 200 USDC, 0 USDT
    setOnchainBalance(200, 0);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();
  });
});

// ─── §5.2 — Discrepancy > threshold: operator alert sent ─────────────────────
describe('ReconciliationWorker §5.2 — Discrepancy over threshold', () => {
  it('calls sendOperatorAlert exactly once with USDC subject when delta > tolerance', async () => {
    // Internal: 200 USDC
    await seedLedgerAccount(150, 0);
    await seedCampaignEscrow(50, 0);
    await setFeeBalance(0, 0);

    // On-chain: 201 USDC → delta = 1 > 0.000001
    setOnchainBalance(201, 0);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).toHaveBeenCalledOnce();
    const [subject, body] = (mockEmail.sendOperatorAlert as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, string];
    expect(subject).toContain('USDC');
    expect(body).toContain('1'); // delta value present in message

    // Worker must NEVER auto-correct — no LedgerAccount mutations
    const acct = await prisma.ledgerAccount.findFirst({
      where: { user_id: { in: createdUserIds } },
    });
    expect(acct?.balance_usdc.toString()).toBe('150'); // unchanged
  });
});

// ─── §5.3 — Sub-threshold delta: no alert (tolerance = 0.000001) ─────────────
describe('ReconciliationWorker §5.3 — Sub-threshold delta', () => {
  it('does not alert when delta is below the 0.000001 tolerance', async () => {
    // Internal: 200 USDC
    await seedLedgerAccount(200, 0);
    await setFeeBalance(0, 0);

    // rawBalance = 200.0000005 * 1_000_000 = 200_000_000.5 raw
    // onchainTotal = 200_000_000.5 / 1_000_000 = 200.0000005
    // delta = |200 - 200.0000005| = 0.0000005 < 0.000001
    setOnchainBalance(200.0000005, 0);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();
  });
});

// ─── §5.4 — USDC and USDT checked independently ───────────────────────────────
describe('ReconciliationWorker §5.4 — USDC and USDT checked independently', () => {
  it('alerts once for USDT discrepancy only when USDC is balanced', async () => {
    // Internal: 100 USDC + 50 USDT
    await seedLedgerAccount(100, 50);
    await setFeeBalance(0, 0);

    // USDC: balanced at 100. USDT: discrepant (55 on-chain vs 50 internal → delta 5)
    setOnchainBalance(100, 55);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).toHaveBeenCalledOnce();
    const [subject] = (mockEmail.sendOperatorAlert as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
    ];
    expect(subject).toContain('USDT');
    expect(subject).not.toContain('USDC');
  });
});

// ─── §5.5 — Zero balances everywhere: no alert ────────────────────────────────
describe('ReconciliationWorker §5.5 — Zero balances everywhere', () => {
  it('does not alert when all ledger rows and on-chain balance are zero', async () => {
    await setFeeBalance(0, 0);
    setOnchainBalance(0, 0);

    // No ledger accounts or escrows seeded — aggregate returns null (treated as 0)
    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();
  });
});
