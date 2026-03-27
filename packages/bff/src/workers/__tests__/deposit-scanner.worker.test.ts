/**
 * Deposit Scanner Worker integration tests — spec §3 (ON-OFF-RAMP-TEST-PLAN.md).
 *
 * Strategy (Option A from §7):
 *   - Bull queue is mocked; the process() callback is captured and invoked directly.
 *   - SolanaService is mocked via container.registerInstance().
 *   - NotificationService is mocked via container.registerInstance().
 *   - crypto.util.decryptString is mocked (return value is void-ed by worker; no AES needed).
 *   - PrismaService is real — connects to PostgreSQL `test` database.
 *
 * All monetary assertions use .toString() — never .toNumber() (coding rules §8.4).
 */

// ─── Module-level mock objects (stable references; per-test impl set in each it()) ─
// Declared before vi.mock() factory so closures can capture them.
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

// Captured Bull process callback — set when startDepositScannerWorker() is called.
let workerTick: (() => Promise<void>) | null = null;

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock('../../utils/queue.util', () => ({
  depositScannerQueue: {
    add: vi.fn().mockResolvedValue(undefined),
    process: vi.fn().mockImplementation((_concurrency: number, cb: () => Promise<void>) => {
      workerTick = cb;
    }),
  },
  withdrawalQueue: { add: vi.fn().mockResolvedValue(undefined) },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined) },
  ocrQueue: { add: vi.fn().mockResolvedValue(undefined) },
  deadlineMonitorQueue: { add: vi.fn().mockResolvedValue(undefined) },
  reconciliationQueue: { add: vi.fn().mockResolvedValue(undefined) },
  refreshTokenCleanupQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

// decryptString is called in the worker but its return value is immediately void-ed.
// Mock it to return any string so it does not throw on the test-DB encrypted_private_key stub.
vi.mock('../../utils/crypto.util', async () => {
  const actual =
    await vi.importActual<typeof import('../../utils/crypto.util')>('../../utils/crypto.util');
  return { ...actual, decryptString: vi.fn().mockReturnValue('not-used-by-worker') };
});

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';

// Type imports only — no module-level evaluation side effects.
import type { PrismaService } from '../../services/prisma.service';

// ─── Shared state ─────────────────────────────────────────────────────────────
let prisma!: PrismaService;

// Tracked IDs for afterEach cleanup
const createdUserIds: string[] = [];
const createdDepositPublicKeys: string[] = [];

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

  // Override container singletons with mocks before any worker resolve() call.
  // `as unknown as X` is required because mock objects omit private fields.
  container.registerInstance(SS, mockSolana as unknown as InstanceType<typeof SS>);
  container.registerInstance(NS, mockNotif as unknown as InstanceType<typeof NS>);
  container.registerInstance(PS, prisma);

  const { startDepositScannerWorker } = await import('../deposit-scanner.worker');
  startDepositScannerWorker(); // registers process callback → sets workerTick
});

afterEach(async () => {
  if (createdDepositPublicKeys.length > 0) {
    await prisma.processedDepositSignature.deleteMany({
      where: { deposit_address_public_key: { in: createdDepositPublicKeys } },
    });
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
    await prisma.depositAddress.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.ledgerAccount.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
    createdDepositPublicKeys.length = 0;
  }

  vi.clearAllMocks();
  mockNotif.send.mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.disconnect();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seeds a user + ledger account + deposit address row. Returns identifiers. */
async function seedDepositUser(opts?: {
  usdcBalance?: number;
  usdtBalance?: number;
}): Promise<{ userId: string; depositPublicKey: string }> {
  const user = await prisma.user.create({
    data: {
      email: `dep-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: true,
    },
  });
  await prisma.ledgerAccount.create({
    data: {
      user_id: user.id,
      balance_usdc: opts?.usdcBalance ?? 0,
      balance_usdt: opts?.usdtBalance ?? 0,
    },
  });
  // Use a deterministic test public key derived from the user ID (no on-chain account needed).
  const depositPublicKey = `DepAddr${user.id.replace(/-/g, '').slice(0, 36)}`;
  await prisma.depositAddress.create({
    data: {
      user_id: user.id,
      public_key: depositPublicKey,
      // Any non-empty string — decryptString is mocked to not inspect the value.
      encrypted_private_key: 'mock:encrypted:privatekey',
    },
  });
  createdUserIds.push(user.id);
  createdDepositPublicKeys.push(depositPublicKey);
  return { userId: user.id, depositPublicKey };
}

/**
 * Builds a minimal ParsedTransactionWithMeta stub containing a single inner SPL
 * transfer instruction directed at `destination`.
 */
function makeParsedTx(destination: string, mintAddr: string, rawAmount: string): object {
  return {
    meta: {
      innerInstructions: [
        {
          index: 0,
          instructions: [
            {
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              parsed: {
                type: 'transfer',
                info: {
                  destination,
                  tokenAmount: { amount: rawAmount },
                  mint: mintAddr,
                },
              },
            },
          ],
        },
      ],
    },
  };
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// ─── §3.1 — Happy path: USDC deposit detected and credited ────────────────────
describe('DepositScannerWorker §3.1 — USDC deposit detected and credited', () => {
  it('credits balance_usdc, updates lifetime_deposited_usdc, creates ProcessedDepositSignature and LedgerTransaction', async () => {
    const { userId, depositPublicKey } = await seedDepositUser();

    const sig = `sig_usdc_${Date.now()}`;
    mockSolana.getSignaturesForAddress.mockResolvedValue([{ signature: sig }]);
    mockSolana.getParsedTransaction.mockResolvedValue(
      makeParsedTx(depositPublicKey, USDC_MINT, '50000000')
    );
    mockSolana.sweepDeposit.mockResolvedValue(`sweep_${Date.now()}`);

    await workerTick!();

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('50');
    expect(account.lifetime_deposited_usdc.toString()).toBe('50');
    expect(account.balance_usdt.toString()).toBe('0');

    const processed = await prisma.processedDepositSignature.findUnique({
      where: { signature: sig },
    });
    expect(processed).not.toBeNull();
    expect(processed!.amount.toString()).toBe('50');
    expect(processed!.currency).toBe('usdc');

    const txRows = await prisma.ledgerTransaction.findMany({ where: { to_account_id: userId } });
    expect(txRows).toHaveLength(1);
    const tx = txRows[0];
    expect(tx.transaction_type).toBe('deposit');
    expect(tx.status).toBe('completed');
    expect(tx.amount.toString()).toBe('50');
    expect(tx.currency).toBe('usdc');
    expect(tx.onchain_signature).toBeTruthy();
  });
});

// ─── §3.2 — Happy path: USDT deposit credited ─────────────────────────────────
describe('DepositScannerWorker §3.2 — USDT deposit credited', () => {
  it('credits balance_usdt and leaves USDC fields untouched', async () => {
    const { userId, depositPublicKey } = await seedDepositUser();

    const sig = `sig_usdt_${Date.now()}`;
    mockSolana.getSignaturesForAddress.mockResolvedValue([{ signature: sig }]);
    mockSolana.getParsedTransaction.mockResolvedValue(
      makeParsedTx(depositPublicKey, USDT_MINT, '75000000')
    );
    mockSolana.sweepDeposit.mockResolvedValue(`sweep_usdt_${Date.now()}`);

    await workerTick!();

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdt.toString()).toBe('75');
    expect(account.lifetime_deposited_usdt.toString()).toBe('75');
    expect(account.balance_usdc.toString()).toBe('0');

    const processed = await prisma.processedDepositSignature.findUnique({
      where: { signature: sig },
    });
    expect(processed).not.toBeNull();
    expect(processed!.currency).toBe('usdt');
  });
});

// ─── §3.3 — Idempotency: same signature processed twice ───────────────────────
describe('DepositScannerWorker §3.3 — Idempotency', () => {
  it('does not double-credit balance or insert a duplicate ProcessedDepositSignature', async () => {
    const { userId, depositPublicKey } = await seedDepositUser();

    const sig = `sig_idem_${Date.now()}`;
    mockSolana.getSignaturesForAddress.mockResolvedValue([{ signature: sig }]);
    mockSolana.getParsedTransaction.mockResolvedValue(
      makeParsedTx(depositPublicKey, USDC_MINT, '50000000')
    );
    mockSolana.sweepDeposit.mockResolvedValue(`sweep_idem_${Date.now()}`);

    // First tick — processes the signature
    await workerTick!();

    // Second tick — same signature returned; idempotency guard should fire
    await workerTick!();

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('50'); // not doubled to 100

    const sigCount = await prisma.processedDepositSignature.count({ where: { signature: sig } });
    expect(sigCount).toBe(1);

    const txCount = await prisma.ledgerTransaction.count({ where: { to_account_id: userId } });
    expect(txCount).toBe(1);
  });
});

// ─── §3.4 — Unknown mint ignored ──────────────────────────────────────────────
describe('DepositScannerWorker §3.4 — Unknown mint ignored', () => {
  it('creates no rows for an unrecognised SPL mint', async () => {
    const { userId, depositPublicKey } = await seedDepositUser();

    const UNKNOWN_MINT = 'UnknownMint111111111111111111111111111111111';
    const sig = `sig_unknown_${Date.now()}`;
    mockSolana.getSignaturesForAddress.mockResolvedValue([{ signature: sig }]);
    mockSolana.getParsedTransaction.mockResolvedValue(
      makeParsedTx(depositPublicKey, UNKNOWN_MINT, '50000000')
    );

    await workerTick!();

    expect(
      await prisma.processedDepositSignature.findUnique({ where: { signature: sig } })
    ).toBeNull();

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('0');
    expect(account.balance_usdt.toString()).toBe('0');

    expect(await prisma.ledgerTransaction.count({ where: { to_account_id: userId } })).toBe(0);
  });
});

// ─── §3.5 — Sweep fails: deposit not credited ─────────────────────────────────
describe('DepositScannerWorker §3.5 — Sweep fails', () => {
  it('leaves balances and DB rows unchanged when sweepDeposit throws', async () => {
    const { userId, depositPublicKey } = await seedDepositUser();

    const sig = `sig_sweep_fail_${Date.now()}`;
    mockSolana.getSignaturesForAddress.mockResolvedValue([{ signature: sig }]);
    mockSolana.getParsedTransaction.mockResolvedValue(
      makeParsedTx(depositPublicKey, USDC_MINT, '50000000')
    );
    mockSolana.sweepDeposit.mockRejectedValue(new Error('sendRawTransaction failed'));

    await workerTick!();

    // Idempotency record must NOT be written on sweep failure
    expect(
      await prisma.processedDepositSignature.findUnique({ where: { signature: sig } })
    ).toBeNull();

    // Balance unchanged — never credited before successful sweep
    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('0');

    // No ledger transaction either
    expect(await prisma.ledgerTransaction.count({ where: { to_account_id: userId } })).toBe(0);
  });
});

// ─── §3.6 — Zero-amount transfer ignored ──────────────────────────────────────
describe('DepositScannerWorker §3.6 — Zero-amount transfer ignored', () => {
  it('skips a transfer whose tokenAmount.amount is "0"', async () => {
    const { userId, depositPublicKey } = await seedDepositUser();

    const sig = `sig_zero_${Date.now()}`;
    mockSolana.getSignaturesForAddress.mockResolvedValue([{ signature: sig }]);
    mockSolana.getParsedTransaction.mockResolvedValue(
      makeParsedTx(depositPublicKey, USDC_MINT, '0')
    );

    await workerTick!();

    expect(
      await prisma.processedDepositSignature.findUnique({ where: { signature: sig } })
    ).toBeNull();

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('0');
  });
});

// ─── §3.7 — Amount conversion accuracy: 6 decimal places ─────────────────────
describe('DepositScannerWorker §3.7 — Amount conversion accuracy', () => {
  it('correctly converts 1 raw unit → 0.000001 balance and LedgerTransaction amount', async () => {
    const { userId, depositPublicKey } = await seedDepositUser();

    const sig = `sig_micro_${Date.now()}`;
    mockSolana.getSignaturesForAddress.mockResolvedValue([{ signature: sig }]);
    mockSolana.getParsedTransaction.mockResolvedValue(
      makeParsedTx(depositPublicKey, USDC_MINT, '1')
    );
    mockSolana.sweepDeposit.mockResolvedValue(`sweep_micro_${Date.now()}`);

    await workerTick!();

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('0.000001');

    const txRows = await prisma.ledgerTransaction.findMany({ where: { to_account_id: userId } });
    expect(txRows).toHaveLength(1);
    expect(txRows[0].amount.toString()).toBe('0.000001');
  });
});
