/**
 * WalletService — balance, deposit address, withdrawals, transaction history.
 * Implements spec §7.5 (withdrawal flow) and §9.2.
 */
import { injectable, inject } from 'tsyringe';
import { PublicKey } from '@solana/web3.js';
import { Prisma } from '@prisma/client';
import pino from 'pino';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { ConfigurationService } from './configuration.service';
import type { GlobalMinimumsConfig, MaxWithdrawalPerDayConfig } from './configuration.service';
import { withdrawalQueue, type WithdrawalJobPayload } from '../utils/queue.util';
import {
  ValidationError,
  InsufficientBalanceError,
  RateLimitError,
  AuthorizationError,
  NotFoundError,
} from '../utils/errors';
import type {
  WithdrawDto,
  WalletBalanceDto,
  DepositAddressDto,
  WithdrawResponseDto,
  LedgerTransactionDto,
  PaginatedResponseDto,
} from 'common';

const logger = pino({ name: 'WalletService' });

@injectable()
export class WalletService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(ConfigurationService) private readonly configService: ConfigurationService
  ) {}

  async getBalance(userId: string): Promise<WalletBalanceDto> {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { user_id: userId },
    });
    if (account === null) throw new NotFoundError('Ledger account not found');
    return {
      balance_usdc: Number(account.balance_usdc),
      balance_usdt: Number(account.balance_usdt),
    };
  }

  async getDepositAddress(userId: string): Promise<DepositAddressDto> {
    const addr = await this.prisma.depositAddress.findUnique({
      where: { user_id: userId },
    });
    if (addr === null) throw new NotFoundError('Deposit address not found');
    return {
      address: addr.public_key,
      qr_hint: `solana:${addr.public_key}`,
    };
  }

  async requestWithdrawal(
    userId: string,
    dto: WithdrawDto,
    isEmailVerified: boolean,
    isBanned: boolean,
    ipAddress?: string
  ): Promise<WithdrawResponseDto> {
    // Guards
    if (isBanned) throw new AuthorizationError('Account suspended');
    if (!isEmailVerified) throw new AuthorizationError('Email verification required');

    // Validate Solana public key (spec §5.5)
    try {
      const pk = new PublicKey(dto.destination_address);
      if (pk.toBytes().length !== 32) {
        throw new Error('Invalid key length');
      }
    } catch {
      throw new ValidationError('Invalid Solana destination address');
    }

    const [globalMinimums, maxPerDay] = await Promise.all([
      this.configService.get<GlobalMinimumsConfig>('global_minimums'),
      this.configService.get<MaxWithdrawalPerDayConfig>('max_withdrawal_per_day'),
    ]);

    if (dto.amount < globalMinimums.min_withdrawal_usd) {
      throw new ValidationError(`Minimum withdrawal is ${globalMinimums.min_withdrawal_usd} USD`);
    }

    // Rolling 24h count (spec §5.5)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.ledgerTransaction.count({
      where: {
        transaction_type: 'withdrawal',
        from_account_id: userId,
        status: { in: ['pending', 'confirmed'] },
        created_at: { gte: since },
      },
    });
    if (recentCount >= maxPerDay.value) {
      throw new RateLimitError('Daily withdrawal limit reached');
    }

    // Check balance
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { user_id: userId },
    });
    if (account === null) throw new NotFoundError('Ledger account not found');

    const currencyField = dto.currency === 'usdc' ? 'balance_usdc' : 'balance_usdt';
    if (Number(account[currencyField]) < dto.amount) {
      throw new InsufficientBalanceError('Insufficient balance');
    }

    let ledgerTxId = '';

    // SERIALIZABLE transaction (spec §7.5 and coding rules §3.5)
    await this.prisma.$transaction(
      async (tx) => {
        // Re-read with SELECT FOR UPDATE equivalent (enforced by SERIALIZABLE)
        const locked = await tx.ledgerAccount.findUniqueOrThrow({
          where: { user_id: userId },
        });

        const currentBalance = Number(locked[currencyField]);
        if (currentBalance < dto.amount) {
          throw new InsufficientBalanceError('Insufficient balance');
        }

        const amountDecimal = new Prisma.Decimal(dto.amount);

        // Debit first (coding rules §5.2)
        if (dto.currency === 'usdc') {
          await tx.ledgerAccount.update({
            where: { user_id: userId },
            data: {
              balance_usdc: { decrement: amountDecimal },
              lifetime_withdrawn_usdc: { increment: amountDecimal },
            },
          });
        } else {
          await tx.ledgerAccount.update({
            where: { user_id: userId },
            data: {
              balance_usdt: { decrement: amountDecimal },
              lifetime_withdrawn_usdt: { increment: amountDecimal },
            },
          });
        }

        const ledgerTx = await tx.ledgerTransaction.create({
          data: {
            transaction_type: 'withdrawal',
            status: 'pending',
            amount: amountDecimal,
            currency: dto.currency,
            from_account_type: 'user',
            from_account_id: userId,
            to_account_type: 'external',
            external_address: dto.destination_address,
          },
        });
        ledgerTxId = ledgerTx.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Enqueue withdrawal job (outside transaction)
    const payload: WithdrawalJobPayload = { ledger_transaction_id: ledgerTxId };
    await withdrawalQueue.add(payload);

    this.audit.log({
      userId,
      action: 'ledger.withdrawal_requested',
      entityType: 'ledger_account',
      entityId: userId,
      changes: { amount: dto.amount, currency: dto.currency, destination: dto.destination_address },
      ipAddress,
    });

    logger.info(
      { userId, ledgerTxId, amount: dto.amount, currency: dto.currency },
      'Withdrawal requested'
    );

    return { ledger_transaction_id: ledgerTxId, status: 'pending' };
  }

  async getTransactions(
    userId: string,
    page = 1,
    limit = 20,
    type?: string
  ): Promise<PaginatedResponseDto<LedgerTransactionDto>> {
    const skip = (page - 1) * limit;
    const where = {
      OR: [
        { from_account_type: 'user' as const, from_account_id: userId },
        { to_account_type: 'user' as const, to_account_id: userId },
      ],
      ...(type ? { transaction_type: type as Prisma.EnumTransactionTypeFilter } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.ledgerTransaction.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ledgerTransaction.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        transaction_type: r.transaction_type,
        amount: Number(r.amount),
        currency: r.currency,
        from_account_type: r.from_account_type,
        to_account_type: r.to_account_type,
        status: r.status,
        onchain_signature: r.onchain_signature,
        created_at: r.created_at.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }
}
