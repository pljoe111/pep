/**
 * DepositScannerWorker — checks SPL token balances on all deposit ATAs each cycle.
 * Spec §7.4. Frequency: 30 seconds, concurrency 1.
 *
 * Strategy (balance-check, not signature-scan):
 *   1. Derive the USDC and USDT ATA for every deposit address (pure math, no RPC).
 *   2. Call getMultipleAccountsInfo once per currency — ONE RPC call fetches all
 *      balances in a batch of up to 100 accounts per request.
 *   3. For any ATA whose raw balance > 0: sweep to master wallet, then credit
 *      the user's unified ledger balance using the sweep signature as the
 *      idempotency key (stored in processedDepositSignature).
 *
 * Option B: credits single unified balance field (currency still recorded on LedgerTransaction).
 */
import pino from 'pino';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Prisma } from '@prisma/client';
import { container } from '../container';
import { depositScannerQueue } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { SolanaService } from '../services/solana.service';
import { NotificationService } from '../services/notification.service';
import { env } from '../config/env.config';

const logger = pino({ name: 'DepositScannerWorker' });

type SupportedCurrency = 'usdc' | 'usdt';

const CURRENCY_MINTS: Record<SupportedCurrency, string> = {
  usdc: env.USDC_MINT,
  usdt: env.USDT_MINT,
};

const DECIMALS = 6; // both USDC and USDT use 6 decimal places

export function startDepositScannerWorker(): void {
  void depositScannerQueue.add(
    {},
    { repeat: { every: 30_000 }, jobId: 'deposit-scanner-repeatable' }
  );

  void depositScannerQueue.process(1, async () => {
    const prisma = container.resolve(PrismaService);
    const solana = container.resolve(SolanaService);
    const notif = container.resolve(NotificationService);

    const depositAddresses = await prisma.depositAddress.findMany();
    logger.debug({ count: depositAddresses.length }, 'Scanning deposit addresses');
    if (depositAddresses.length === 0) return;

    for (const currency of ['usdc', 'usdt'] as const) {
      const mintAddress = CURRENCY_MINTS[currency];
      const mintPubkey = new PublicKey(mintAddress);

      // Derive all ATAs for this currency (pure computation — no RPC calls)
      const ataAddresses = await Promise.all(
        depositAddresses.map(async (depAddr) => {
          const ownerPubkey = new PublicKey(depAddr.public_key);
          const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
          return { ataAddress: ata.toBase58(), depAddr };
        })
      );

      // ONE batched RPC call fetches all balances at once
      const balances = await solana.getMultipleTokenBalances(ataAddresses.map((e) => e.ataAddress));

      for (const { ataAddress, depAddr } of ataAddresses) {
        const rawBalance = balances.get(ataAddress) ?? 0n;
        if (rawBalance <= 0n) continue;

        // Sweep tokens from deposit ATA → master wallet
        let sweepSignature: string;
        try {
          sweepSignature = await solana.sweepDeposit(
            depAddr.encrypted_private_key,
            rawBalance,
            currency
          );
        } catch (sweepError: unknown) {
          const msg = sweepError instanceof Error ? sweepError.message : String(sweepError);
          logger.error(
            {
              error: msg,
              address: depAddr.public_key,
              ataAddress,
              currency,
              rawBalance: rawBalance.toString(),
            },
            'Sweep failed — will retry next cycle'
          );
          continue;
        }

        // Credit unified ledger balance.
        // sweepSignature is the idempotency key — if the DB write was already
        // recorded from a previous (partially-failed) cycle, skip silently.
        const amount = new Prisma.Decimal(rawBalance.toString()).div(
          new Prisma.Decimal(10 ** DECIMALS)
        );

        await prisma.$transaction(
          async (tx) => {
            try {
              await tx.processedDepositSignature.create({
                data: {
                  signature: sweepSignature,
                  deposit_address_public_key: depAddr.public_key,
                  amount,
                  currency,
                },
              });
            } catch {
              // Unique constraint violation — sweep already credited. Skip.
              return;
            }

            await tx.ledgerAccount.update({
              where: { user_id: depAddr.user_id },
              data: {
                balance: { increment: amount },
                lifetime_deposited: { increment: amount },
              },
            });

            await tx.ledgerTransaction.create({
              data: {
                transaction_type: 'deposit',
                status: 'completed',
                amount,
                currency,
                from_account_type: 'external',
                to_account_type: 'user',
                to_account_id: depAddr.user_id,
                onchain_signature: sweepSignature,
              },
            });

            await notif.send(
              depAddr.user_id,
              'deposit_confirmed',
              'system',
              'Deposit Received',
              `${amount.toFixed(2)} ${currency.toUpperCase()} has been credited to your balance.`
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        logger.info(
          {
            address: depAddr.public_key,
            ataAddress,
            amount: amount.toFixed(6),
            currency,
            sweepSignature,
          },
          'Deposit processed'
        );
      }
    }
  });
}
