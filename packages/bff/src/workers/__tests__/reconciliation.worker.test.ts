/**
 * Reconciliation Worker integration tests — spec §5 (ON-OFF-RAMP-TEST-PLAN.md).
 * Option B: single unified balance. Compares SUM(all ledger balances) vs. combined on-chain.
 *
 * Strategy:
 *   - Bull reconciliation queue is mocked; the process() callback is captured.
 *   - SolanaService.getTokenBalance is mocked for both USDC and USDT.
 *   - EmailService.sendOperatorAlert is mocked.
 *   - PrismaService is real.
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
  swapToUsdt: vi.fn(),
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

const createdUserIds: string[] = [];
const createdCampaignIds: string[] = [];

// ─── Env + container bootstrap ────────────────────────────────────────────────
beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/test';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters!!';
  process.env.USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  process.env.USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  process.env.PYUSD_MINT = 'CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM';
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
  startReconciliationWorker();
});

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    await prisma.campaignEscrow.deleteMany({ where: { campaign_id: { in: createdCampaignIds } } });
    await prisma.campaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
    createdCampaignIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.ledgerAccount.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
  // Reset fee account back to zero so tests are independent
  await prisma.feeAccount.updateMany({ data: { balance: 0 } });
  // Reset master wallet snapshot back to zero so tests are independent
  // pyusd_balance cast until Prisma client type is fully propagated in the test runner
  await prisma.masterWallet.updateMany({
    data: {
      usdc_balance: 0,
      usdt_balance: 0,
      pyusd_balance: 0,
    } as Parameters<typeof prisma.masterWallet.updateMany>[0]['data'],
  });

  vi.clearAllMocks();
  mockEmail.sendOperatorAlert.mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.disconnect();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seeds a ledger account with the given unified balance. */
async function seedLedgerAccount(balance: number): Promise<void> {
  const user = await prisma.user.create({
    data: {
      email: `recon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: true,
    },
  });
  await prisma.ledgerAccount.create({
    data: { user_id: user.id, balance },
  });
  createdUserIds.push(user.id);
}

/** Seeds a campaign escrow with the given unified balance. */
async function seedCampaignEscrow(balance: number): Promise<void> {
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
    data: { campaign_id: campaign.id, balance },
  });
}

/** Sets the single FeeAccount row's unified balance. */
async function setFeeBalance(balance: number): Promise<void> {
  const existing = await prisma.feeAccount.findFirst();
  if (existing !== null) {
    await prisma.feeAccount.update({ where: { id: existing.id }, data: { balance } });
  } else {
    await prisma.feeAccount.create({ data: { balance } });
  }
}

/**
 * Sets mock USDC, USDT and PyUSD on-chain balances.
 * Internal total should equal usdcDisplay + usdtDisplay + pyusdDisplay for a balanced state.
 */
function setOnchainBalance(usdcDisplay: number, usdtDisplay: number, pyusdDisplay = 0): void {
  mockSolana.getTokenBalance.mockImplementation(
    (_addr: string, currency: 'usdc' | 'usdt' | 'pyusd') => {
      if (currency === 'usdc') return Promise.resolve(usdcDisplay * 1_000_000);
      if (currency === 'usdt') return Promise.resolve(usdtDisplay * 1_000_000);
      return Promise.resolve(pyusdDisplay * 1_000_000);
    }
  );
}

// ─── §5.1 — Balanced state: no alert sent ─────────────────────────────────────
describe('ReconciliationWorker §5.1 — Balanced state', () => {
  it('does not call sendOperatorAlert when internal total matches on-chain combined balance', async () => {
    // Internal: 150 ledger + 50 escrow + 0 fee = 200
    await seedLedgerAccount(150);
    await seedCampaignEscrow(50);
    await setFeeBalance(0);

    // On-chain: 200 total (any split of USDC+USDT)
    setOnchainBalance(200, 0);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();
  });

  it('writes the on-chain balances to MasterWallet after a successful pass', async () => {
    await seedLedgerAccount(200);
    await setFeeBalance(0);

    // On-chain: 150 USDC + 50 USDT = 200 total — balanced
    setOnchainBalance(150, 50);

    await reconcileTick!();

    const mw = await prisma.masterWallet.findFirst();
    expect(mw?.usdc_balance.toString()).toBe('150');
    expect(mw?.usdt_balance.toString()).toBe('50');
  });
});

// ─── §5.2 — Discrepancy > threshold: operator alert sent ─────────────────────
describe('ReconciliationWorker §5.2 — Discrepancy over threshold', () => {
  it('calls sendOperatorAlert when on-chain total differs from internal total by > tolerance', async () => {
    // Internal: 200
    await seedLedgerAccount(150);
    await seedCampaignEscrow(50);
    await setFeeBalance(0);

    // On-chain: 201 → delta = 1 > 0.000001
    setOnchainBalance(201, 0);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).toHaveBeenCalledOnce();
    const [subject, body] = (mockEmail.sendOperatorAlert as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, string];
    expect(subject).toContain('Reconciliation');
    expect(body).toContain('201'); // on-chain total in message

    // Worker must NEVER auto-correct — no LedgerAccount mutations
    const acct = await prisma.ledgerAccount.findFirst({
      where: { user_id: { in: createdUserIds } },
    });
    expect(acct?.balance.toString()).toBe('150'); // unchanged
  });
});

// ─── §5.3 — Sub-threshold delta: no alert ────────────────────────────────────
describe('ReconciliationWorker §5.3 — Sub-threshold delta', () => {
  it('does not alert when delta is below the 0.000001 tolerance', async () => {
    // Internal: 200
    await seedLedgerAccount(200);
    await setFeeBalance(0);

    // On-chain: 200.0000005 → delta 0.0000005 < 0.000001
    setOnchainBalance(200.0000005, 0);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();
  });
});

// ─── §5.4 — Combined on-chain balance check ───────────────────────────────────
describe('ReconciliationWorker §5.4 — Combined on-chain balance', () => {
  it('compares internal total against USDC + USDT combined on-chain balance', async () => {
    // Internal: 150
    await seedLedgerAccount(150);
    await setFeeBalance(0);

    // On-chain: 100 USDC + 57 USDT = 157 → delta = |150 - 157| = 7 > threshold
    setOnchainBalance(100, 57);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).toHaveBeenCalledOnce();
    const [subject] = (mockEmail.sendOperatorAlert as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
    ];
    expect(subject).toContain('Reconciliation');
  });
});

// ─── §5.5 — Zero balances everywhere: no alert ────────────────────────────────
describe('ReconciliationWorker §5.5 — Zero balances everywhere', () => {
  it('does not alert when all ledger rows and on-chain balance are zero', async () => {
    await setFeeBalance(0);
    setOnchainBalance(0, 0);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();
  });
});

// ─── §5.6 — 3-currency on-chain sum: USDC + USDT + PyUSD ─────────────────────
describe('ReconciliationWorker §5.6 — Three-currency on-chain balance (USDC + USDT + PyUSD)', () => {
  it('counts pyusd in the on-chain total and does not alert when all three sum correctly', async () => {
    // Internal: 300 ledger
    await seedLedgerAccount(300);
    await setFeeBalance(0);

    // On-chain: 100 USDC + 150 USDT + 50 PyUSD = 300 → balanced
    setOnchainBalance(100, 150, 50);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();
  });

  it('alerts when PyUSD residual causes on-chain total to diverge from ledger total', async () => {
    // Internal: 200
    await seedLedgerAccount(200);
    await setFeeBalance(0);

    // On-chain: 100 USDC + 100 USDT + 10 PyUSD = 210 → delta = 10 > threshold
    setOnchainBalance(100, 100, 10);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).toHaveBeenCalledOnce();
  });
});

// ─── §5.7 — PyUSD balance written to MasterWallet snapshot ────────────────────
describe('ReconciliationWorker §5.7 — PyUSD balance persisted to MasterWallet snapshot', () => {
  it('writes pyusd_balance to the MasterWallet row after reconciliation pass', async () => {
    await seedLedgerAccount(200);
    await setFeeBalance(0);

    // On-chain: 100 USDC + 75 USDT + 25 PyUSD = 200 → balanced
    setOnchainBalance(100, 75, 25);

    await reconcileTick!();

    expect(mockEmail.sendOperatorAlert).not.toHaveBeenCalled();

    const mw = await prisma.masterWallet.findFirst();
    expect(mw?.usdc_balance.toString()).toBe('100');
    expect(mw?.usdt_balance.toString()).toBe('75');
    // pyusd_balance is written via cast — verify it's a numeric field that was set
    expect(Number((mw as unknown as { pyusd_balance: unknown })?.pyusd_balance ?? 0)).toBeCloseTo(
      25,
      4
    );
  });
});
