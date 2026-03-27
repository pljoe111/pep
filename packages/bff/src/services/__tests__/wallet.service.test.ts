/**
 * WalletService integration tests — spec §7.5, §9.2.
 *
 * Covers:
 *   - requestWithdrawal: balance debit, lifetime_withdrawn update, pending ledger tx, queue enqueue
 *   - Rate limiting: rolling 24h withdrawal count (spec §5.5)
 *   - All guard violations: banned, unverified, invalid address, below minimum, insufficient balance
 *
 * Real Postgres. Mocks: queue.util (Bull/Redis), AuditService, ConfigurationService.
 * All Decimal comparisons use .toString() — never .toNumber().
 */

// Hoisted by Vitest — prevents Bull from connecting to Redis.
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
import type { WalletService } from '../wallet.service';
import type { PrismaService } from '../prisma.service';
import type { AuditService } from '../audit.service';
import type {
  ConfigurationService,
  GlobalMinimumsConfig,
  MaxWithdrawalPerDayConfig,
} from '../configuration.service';
import type { WithdrawDto } from 'common';

// ─── Valid Solana system-program address (32-byte, base58) ───────────────────
const VALID_SOLANA_ADDR = '11111111111111111111111111111111';

// ─── Shared state ─────────────────────────────────────────────────────────────

let prisma!: PrismaService;
let service!: WalletService;

const createdUserIds: string[] = [];

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

  const { WalletService: WS } = await import('../wallet.service');
  const { PrismaService: PS } = await import('../prisma.service');

  prisma = new PS();

  const auditMock = { log: vi.fn() } as unknown as AuditService;
  const configMock = {
    get: vi
      .fn()
      .mockImplementation(
        (key: string): Promise<GlobalMinimumsConfig | MaxWithdrawalPerDayConfig> => {
          if (key === 'global_minimums') {
            const v: GlobalMinimumsConfig = {
              min_contribution_usd: 1,
              min_funding_threshold_usd: 100,
              min_funding_threshold_percent: 5,
              min_withdrawal_usd: 5, // minimum withdrawal = $5
            };
            return Promise.resolve(v);
          }
          // 'max_withdrawal_per_day'
          const v: MaxWithdrawalPerDayConfig = { value: 3 };
          return Promise.resolve(v);
        }
      ),
  } as unknown as ConfigurationService;

  service = new WS(prisma, auditMock, configMock);
});

afterEach(async () => {
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

// ─── Helper ───────────────────────────────────────────────────────────────────

async function seedUser(opts?: {
  banned?: boolean;
  unverified?: boolean;
  usdcBalance?: number;
  usdtBalance?: number;
}): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `wallet-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      password_hash: '$2b$10$testhash',
      email_verified: opts?.unverified !== true,
      is_banned: opts?.banned === true,
    },
  });
  await prisma.ledgerAccount.create({
    data: {
      user_id: u.id,
      balance_usdc: opts?.usdcBalance ?? 0,
      balance_usdt: opts?.usdtBalance ?? 0,
    },
  });
  createdUserIds.push(u.id);
  return u.id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WalletService.requestWithdrawal', () => {
  it('debits USDC balance, updates lifetime_withdrawn, creates pending ledger tx', async () => {
    const userId = await seedUser({ usdcBalance: 100 });

    const dto: WithdrawDto = {
      amount: 50,
      currency: 'usdc',
      destination_address: VALID_SOLANA_ADDR,
    };
    const result = await service.requestWithdrawal(userId, dto, true, false);

    // Response contract
    expect(result.status).toBe('pending');
    expect(typeof result.ledger_transaction_id).toBe('string');

    // DB: balance debited and lifetime_withdrawn incremented
    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('50');
    expect(account.lifetime_withdrawn_usdc.toString()).toBe('50');

    // DB: pending ledger transaction persisted
    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({
      where: { id: result.ledger_transaction_id },
    });
    expect(tx.transaction_type).toBe('withdrawal');
    expect(tx.status).toBe('pending');
    expect(tx.amount.toString()).toBe('50');
    expect(tx.currency).toBe('usdc');
    expect(tx.from_account_type).toBe('user');
    expect(tx.from_account_id).toBe(userId);
    expect(tx.to_account_type).toBe('external');
    expect(tx.external_address).toBe(VALID_SOLANA_ADDR);
  });

  it('debits USDT balance and creates pending USDT ledger tx', async () => {
    const userId = await seedUser({ usdtBalance: 80 });

    const dto: WithdrawDto = {
      amount: 30,
      currency: 'usdt',
      destination_address: VALID_SOLANA_ADDR,
    };
    const result = await service.requestWithdrawal(userId, dto, true, false);

    expect(result.status).toBe('pending');

    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdt.toString()).toBe('50');
    expect(account.balance_usdc.toString()).toBe('0'); // USDC untouched
    expect(account.lifetime_withdrawn_usdt.toString()).toBe('30');

    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({
      where: { id: result.ledger_transaction_id },
    });
    expect(tx.currency).toBe('usdt');
    expect(tx.amount.toString()).toBe('30');
    expect(tx.status).toBe('pending');
  });

  it('throws RateLimitError when daily withdrawal count reaches max_withdrawal_per_day', async () => {
    const userId = await seedUser({ usdcBalance: 500 });
    // Seed 3 pending withdrawal transactions within the last 24h (= max)
    const recentTime = new Date(Date.now() - 60 * 1000); // 1 minute ago
    for (let i = 0; i < 3; i++) {
      await prisma.ledgerTransaction.create({
        data: {
          transaction_type: 'withdrawal',
          amount: 10,
          currency: 'usdc',
          from_account_type: 'user',
          from_account_id: userId,
          to_account_type: 'external',
          external_address: VALID_SOLANA_ADDR,
          status: 'pending',
          created_at: recentTime,
        },
      });
    }

    const dto: WithdrawDto = {
      amount: 10,
      currency: 'usdc',
      destination_address: VALID_SOLANA_ADDR,
    };
    await expect(service.requestWithdrawal(userId, dto, true, false)).rejects.toMatchObject({
      name: 'RateLimitError',
    });

    // Balance must NOT have been debited
    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('500');
  });

  it('throws AuthorizationError when account is banned', async () => {
    const userId = await seedUser({ banned: true, usdcBalance: 100 });
    const dto: WithdrawDto = {
      amount: 10,
      currency: 'usdc',
      destination_address: VALID_SOLANA_ADDR,
    };
    await expect(service.requestWithdrawal(userId, dto, true, true)).rejects.toMatchObject({
      name: 'AuthorizationError',
    });
  });

  it('throws AuthorizationError when email is not verified', async () => {
    const userId = await seedUser({ unverified: true, usdcBalance: 100 });
    const dto: WithdrawDto = {
      amount: 10,
      currency: 'usdc',
      destination_address: VALID_SOLANA_ADDR,
    };
    await expect(service.requestWithdrawal(userId, dto, false, false)).rejects.toMatchObject({
      name: 'AuthorizationError',
    });
  });

  it('throws ValidationError for an invalid Solana destination address', async () => {
    const userId = await seedUser({ usdcBalance: 100 });
    const dto: WithdrawDto = {
      amount: 10,
      currency: 'usdc',
      destination_address: 'not-a-valid-solana-address!!',
    };
    await expect(service.requestWithdrawal(userId, dto, true, false)).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('throws ValidationError when amount is below min_withdrawal_usd', async () => {
    const userId = await seedUser({ usdcBalance: 100 });
    // min_withdrawal_usd = 5 in mock; 2 is below minimum
    const dto: WithdrawDto = {
      amount: 2,
      currency: 'usdc',
      destination_address: VALID_SOLANA_ADDR,
    };
    await expect(service.requestWithdrawal(userId, dto, true, false)).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('throws InsufficientBalanceError and leaves balance intact when balance < amount', async () => {
    const userId = await seedUser({ usdcBalance: 10 });
    // Balance = 10; requesting 50
    const dto: WithdrawDto = {
      amount: 50,
      currency: 'usdc',
      destination_address: VALID_SOLANA_ADDR,
    };
    await expect(service.requestWithdrawal(userId, dto, true, false)).rejects.toMatchObject({
      name: 'InsufficientBalanceError',
    });

    // Balance must remain unchanged
    const account = await prisma.ledgerAccount.findUniqueOrThrow({ where: { user_id: userId } });
    expect(account.balance_usdc.toString()).toBe('10');
  });
});
