/**
 * WithdrawalWorker — processes withdrawal jobs from the withdrawal queue.
 * Concurrency: 1. Timeout: 90s. Retries: 2 (then restore balance).
 * Implements spec §7.5.1.
 * Option B: rollback restores single unified balance; always sends USDT on-chain.
 *
 * SECURITY: MASTER_WALLET_PRIVATE_KEY is accessed here via SolanaService.
 * Coding rules §8.3.
 */
import pino from 'pino';
import { container } from '../container';
import { withdrawalQueue, type WithdrawalJobPayload } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { SolanaService } from '../services/solana.service';
import { NotificationService } from '../services/notification.service';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.config';

const logger = pino({ name: 'WithdrawalWorker' });

export function startWithdrawalWorker(): void {
  void withdrawalQueue.process(1, async (job) => {
    const { ledger_transaction_id } = job.data as WithdrawalJobPayload;
    const prisma = container.resolve(PrismaService);
    const solana = container.resolve(SolanaService);
    const notif = container.resolve(NotificationService);

    const ledgerTx = await prisma.ledgerTransaction.findUnique({
      where: { id: ledger_transaction_id },
    });

    if (ledgerTx === null || ledgerTx.status !== 'pending') {
      logger.warn(
        { ledger_transaction_id },
        'WithdrawalWorker: transaction not found or not pending — skipping'
      );
      return;
    }

    // Idempotency check: if signature already exists, confirm it (spec §7.5.1 retry safety)
    if (ledgerTx.onchain_signature !== null) {
      const existing = await solana.getTransaction(ledgerTx.onchain_signature);
      if (existing !== null) {
        await prisma.ledgerTransaction.update({
          where: { id: ledger_transaction_id },
          data: { status: 'confirmed' },
        });
        logger.info(
          { ledger_transaction_id, sig: ledgerTx.onchain_signature },
          'Withdrawal already landed — marking confirmed'
        );
        return;
      }
    }

    // SAFETY: external_address is validated during withdrawal request; never null for withdrawal type.
    const destinationAddress = ledgerTx.external_address!;
    const amount = BigInt(Math.round(Number(ledgerTx.amount) * 1_000_000));

    try {
      // Option B: always send as USDT on-chain (env.USDT_MINT is the on-chain token)
      // SolanaService.executeWithdrawal accepts 'usdc' | 'usdt' — pass 'usdt' always.
      void env.USDT_MINT; // assert env is loaded
      const signature = await solana.executeWithdrawal(destinationAddress, amount, 'usdt');

      await prisma.ledgerTransaction.update({
        where: { id: ledger_transaction_id },
        data: { status: 'confirmed', onchain_signature: signature, currency: 'usdt' },
      });

      // Notify user if from_account_id is set (not fee sweep)
      if (ledgerTx.from_account_id !== null) {
        await notif.send(
          ledgerTx.from_account_id,
          'withdrawal_sent',
          'system',
          'Withdrawal Sent',
          `Your withdrawal has been processed on-chain.`
        );
      }

      logger.info({ ledger_transaction_id, signature }, 'Withdrawal confirmed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ ledger_transaction_id, error: message }, 'Withdrawal execution failed');
      throw error; // Bull will retry
    }
  });

  // On final failure (after all retries exhausted): restore balance
  withdrawalQueue.on('failed', (job, error: Error) => {
    void (async (): Promise<void> => {
      if (job.attemptsMade < (job.opts.attempts ?? 1)) return; // Not final failure yet

      const { ledger_transaction_id } = job.data as WithdrawalJobPayload;
      const prisma = container.resolve(PrismaService);
      const notif = container.resolve(NotificationService);

      logger.error(
        { ledger_transaction_id, error: error.message },
        'Withdrawal permanently failed — restoring balance'
      );

      const ledgerTx = await prisma.ledgerTransaction.findUnique({
        where: { id: ledger_transaction_id },
      });
      if (ledgerTx === null || ledgerTx.status !== 'pending') return;

      await prisma.$transaction(
        async (tx) => {
          // Option B: restore single unified balance
          if (ledgerTx.from_account_id !== null) {
            await tx.ledgerAccount.update({
              where: { user_id: ledgerTx.from_account_id },
              data: {
                balance: { increment: ledgerTx.amount },
                lifetime_withdrawn: { decrement: ledgerTx.amount },
              },
            });
          }
          await tx.ledgerTransaction.update({
            where: { id: ledger_transaction_id },
            data: { status: 'failed' },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (ledgerTx.from_account_id !== null) {
        await notif.send(
          ledgerTx.from_account_id,
          'withdrawal_failed',
          'system',
          'Withdrawal Failed',
          'Your withdrawal failed and funds have been restored to your balance.'
        );
      }
    })();
  });
}
