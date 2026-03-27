/**
 * Withdrawal Worker integration tests — spec §4 (ON-OFF-RAMP-TEST-PLAN.md).
 *
 * Strategy (Option A from §7):
 *   - Bull withdrawal queue is mocked; the process() callback AND the 'failed' event
 *     handler are captured and invoked directly.
 *   - SolanaService and NotificationService are mocked via container.registerInstance().
 *   - PrismaService is real — connects to PostgreSQL `test` database.
 *
 * All monetary assertions use .toString() — never .toNumber() (coding rules §8.4).
 */

// ─── Captured Bull callbacks ───────────────────────────────────────────────────
type JobLike = {
  data: { ledger_transaction_id: string };
  opts: { attempts?: number };
  attemptsMade: number;
};

let withdrawalProcessFn: ((job: JobLike) => Promise<void>) | null = null;
let withdrawalFailedHandler: ((job: JobLike, error: Error) => void) | null = null;

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

const mockNotif = {
  send: vi.fn().mockResolvedValue(undefined),
};

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock('../../utils/queue.util', () => ({
  withdrawalQueue: {
    add: vi.fn().mockResolvedValue(undefined),
    process: vi
      .fn()
      .mockImplementation((_concurrency: number, cb: (job: JobLike) => Promise<void>) => {
        withdrawalProcessFn = cb;
      }),
    on: vi.fn().mockImplementation((event: string, cb: (job: JobLike, error: Error) => void) => {
      if (event === 'failed') withdrawalFailedHandler = cb;
    }),
  },
  depositScannerQueue: { add: vi.fn().mockResolvedValue(undefined) },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined) },
  ocrQueue: { add: vi.fn().mockResolvedValue(undefined) },
  deadlineMonitorQueue: { add: vi.fn().mockResolvedValue(undefined) },
  reconciliationQueue: { add: vi.fn().mockResolvedValue(undefined) },
  refreshTokenCleanupQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';

import type { PrismaService } from '../../services/prisma.service';

// ─── Shared state ─────────────────────────────────────────────────────────────
let prisma!: PrismaService;
const createdUserIds: string[] = [];
const createdLedgerTxIds: string[] = [];

// Valid base58 Solana address for test destination
const DEST_PUBKEY = '11111111111111111111111111111112'; // system program + 1 for variety

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
  const { NotificationService: NS } = await import('../../services/notification.service');
  const { container } = await import('../../container');

  prisma = new PS();

  container.registerInstance(SS, mockSolana as unknown as InstanceType<typeof SS>);
  container.registerInstance(NS, mockNotif as unknown as InstanceType<typeof NS>);
  container.registerInstance(PS, prisma);

  const { startWithdrawalWorker } = await import('../withdrawal.worker');
  startWithdrawalWorker(); // registers process callback and failed handler
});

afterEach(async () => {
  if (createdLedgerTxIds.length > 0) {
    await prisma.ledgerTransaction.deleteMany({ where: { id: { in: createdLedgerTxIds } } });
    createdLedgerTxIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.ledgerAccount.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }

  vi.clearAllMocks();
  mockNotif.send.mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.disconnect();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedUser(opts?: {
  usdcBalance?: number;
  usdtBalance?: number;
  lifetime_withdrawn_usdc?: number;
  lifetime_withdrawn_usdt?: number;
}): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `withdrawal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: true,
    },
  });
  await prisma.ledgerAccount.create({
    data: {
      user_id: user.id,
      balance_usdc: opts?.usdcBalance ?? 0,
      balance_usdt: opts?.usdtBalance ?? 0,
      lifetime_withdrawn_usdc: opts?.lifetime_withdrawn_usdc ?? 0,
      lifetime_withdrawn_usdt: opts?.lifetime_withdrawn_usdt ?? 0,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function seedPendingWithdrawal(
  userId: string | null,
  amount: string,
  currency: 'usdc' | 'usdt',
  opts?: { onchain_signature?: string; status?: 'pending' | 'confirmed' | 'failed' }
): Promise<string> {
  const tx = await prisma.ledgerTransaction.create({
    data: {
      transaction_type: 'withdrawal',
      status: opts?.status ?? 'pending',
      amount,
      currency,
      from_account_type: userId !== null ? 'user' : 'fee',
      from_account_id: userId,
      to_account_type: 'external',
      external_address: DEST_PUBKEY,
      onchain_signature: opts?.onchain_signature ?? null,
    },
  });
  createdLedgerTxIds.push(tx.id);
  return tx.id;
}

/** Builds a fake job object that the withdrawal worker expects. */
function makeJob(
  ledger_transaction_id: string,
  opts: { attempts?: number; attemptsMade?: number } = {}
): JobLike {
  return {
    data: { ledger_transaction_id },
    opts: { attempts: opts.attempts ?? 3 },
    attemptsMade: opts.attemptsMade ?? 1,
  };
}

// ─── §4.1 — Happy path: USDC withdrawal confirmed on-chain ────────────────────
describe('WithdrawalWorker §4.1 — USDC withdrawal confirmed on-chain', () => {
  it('updates status to confirmed and sets onchain_signature', async () => {
    const userId = await seedUser();
    const txId = await seedPendingWithdrawal(userId, '10', 'usdc');

    const fakeSig = `wd_sig_usdc_${Date.now()}`;
    mockSolana.executeWithdrawal.mockResolvedValue(fakeSig);

    await withdrawalProcessFn!(makeJob(txId));

    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId } });
    expect(tx.status).toBe('confirmed');
    expect(tx.onchain_signature).toBe(fakeSig);

    // executeWithdrawal called with correct bigint amount: 10 * 1_000_000 = 10_000_000n
    expect(mockSolana.executeWithdrawal).toHaveBeenCalledWith(DEST_PUBKEY, 10_000_000n, 'usdc');
  });
});

// ─── §4.2 — Happy path: USDT withdrawal confirmed ─────────────────────────────
describe('WithdrawalWorker §4.2 — USDT withdrawal confirmed', () => {
  it('confirms USDT withdrawal and calls executeWithdrawal with correct args', async () => {
    const userId = await seedUser();
    const txId = await seedPendingWithdrawal(userId, '25', 'usdt');

    const fakeSig = `wd_sig_usdt_${Date.now()}`;
    mockSolana.executeWithdrawal.mockResolvedValue(fakeSig);

    await withdrawalProcessFn!(makeJob(txId));

    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId } });
    expect(tx.status).toBe('confirmed');
    expect(tx.onchain_signature).toBe(fakeSig);

    expect(mockSolana.executeWithdrawal).toHaveBeenCalledWith(DEST_PUBKEY, 25_000_000n, 'usdt');
  });
});

// ─── §4.3 — Idempotency: onchain_signature already set and tx already landed ──
describe('WithdrawalWorker §4.3 — Idempotency: signature pre-set', () => {
  it('marks confirmed and does NOT send a duplicate transfer when signature already exists on-chain', async () => {
    const userId = await seedUser();
    const existingSig = `existing_sig_${Date.now()}`;
    const txId = await seedPendingWithdrawal(userId, '5', 'usdc', {
      onchain_signature: existingSig,
    });

    // getTransaction returns non-null → tx already landed
    mockSolana.getTransaction.mockResolvedValue({ slot: 12345 });

    await withdrawalProcessFn!(makeJob(txId));

    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId } });
    expect(tx.status).toBe('confirmed');

    // No new on-chain transfer should have been sent
    expect(mockSolana.executeWithdrawal).not.toHaveBeenCalled();
  });
});

// ─── §4.4 — Already confirmed: worker returns early ──────────────────────────
describe('WithdrawalWorker §4.4 — Already confirmed: worker returns early', () => {
  it('does nothing when ledger transaction status is already confirmed', async () => {
    const userId = await seedUser();
    const txId = await seedPendingWithdrawal(userId, '5', 'usdc', { status: 'confirmed' });

    await withdrawalProcessFn!(makeJob(txId));

    // Status must remain confirmed unchanged
    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId } });
    expect(tx.status).toBe('confirmed');

    // No on-chain work done
    expect(mockSolana.executeWithdrawal).not.toHaveBeenCalled();
    expect(mockSolana.getTransaction).not.toHaveBeenCalled();
  });
});

// ─── §4.5 — Permanent failure: balance restored ───────────────────────────────
describe('WithdrawalWorker §4.5 — Permanent failure: balance restored', () => {
  it('restores balance_usdc and decrements lifetime_withdrawn_usdc on permanent failure', async () => {
    const userId = await seedUser({ usdcBalance: 0, lifetime_withdrawn_usdc: 10 });
    const txId = await seedPendingWithdrawal(userId, '10', 'usdc');

    // Simulate permanent failure: attemptsMade === attempts
    const failedJob = makeJob(txId, { attempts: 1, attemptsMade: 1 });
    const failureError = new Error('RPC failure — all retries exhausted');

    // The failed handler fires an async IIFE — call it and wait for all micro tasks
    withdrawalFailedHandler!(failedJob, failureError);
    // Give the async IIFE enough time to complete database writes
    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('10'); // balance restored
    expect(account.lifetime_withdrawn_usdc.toString()).toBe('0'); // decremented back

    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId } });
    expect(tx.status).toBe('failed');
  });
});

// ─── §4.6 — from_account_id = null: balance NOT restored ─────────────────────
describe('WithdrawalWorker §4.6 — from_account_id null (fee sweep path)', () => {
  it('does not attempt a LedgerAccount update when from_account_id is null', async () => {
    // Insert a withdrawal with no user account (fee sweep)
    const txId = await seedPendingWithdrawal(null, '5', 'usdc');

    const failedJob = makeJob(txId, { attempts: 1, attemptsMade: 1 });
    withdrawalFailedHandler!(failedJob, new Error('RPC failure'));
    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId } });
    expect(tx.status).toBe('failed');

    // No LedgerAccount should have been mutated (there is none for this tx)
    expect(mockNotif.send).not.toHaveBeenCalled(); // no user to notify
  });
});

// ─── §4.7 — Amount conversion accuracy ───────────────────────────────────────
describe('WithdrawalWorker §4.7 — Amount conversion accuracy', () => {
  const cases: Array<{ dbAmount: string; expectedRaw: bigint }> = [
    { dbAmount: '10.500000', expectedRaw: 10_500_000n },
    { dbAmount: '0.000001', expectedRaw: 1n },
    { dbAmount: '1000.123456', expectedRaw: 1_000_123_456n },
  ];

  for (const { dbAmount, expectedRaw } of cases) {
    it(`converts DB amount "${dbAmount}" → ${expectedRaw} raw bigint`, async () => {
      const userId = await seedUser();
      const txId = await seedPendingWithdrawal(userId, dbAmount, 'usdc');

      mockSolana.executeWithdrawal.mockResolvedValue(`wd_sig_${Date.now()}`);

      await withdrawalProcessFn!(makeJob(txId));

      expect(mockSolana.executeWithdrawal).toHaveBeenCalledWith(DEST_PUBKEY, expectedRaw, 'usdc');

      // Confirm the tx completed
      const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId } });
      expect(tx.status).toBe('confirmed');
    });
  }
});
