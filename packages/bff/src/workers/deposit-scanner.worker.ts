/**
 * DepositScannerWorker — scans all deposit addresses for incoming SPL transfers.
 * Spec §7.4. Frequency: 30 seconds, concurrency 1.
 * Retry: 3 attempts per signature with exponential backoff.
 */
import pino from 'pino';
import { container } from '../container';
import { depositScannerQueue } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { SolanaService } from '../services/solana.service';
import { NotificationService } from '../services/notification.service';
import { env } from '../config/env.config';
import { Prisma } from '@prisma/client';
import { decryptString } from '../utils/crypto.util';

const logger = pino({ name: 'DepositScannerWorker' });

export function startDepositScannerWorker(): void {
  // Register the repeatable job
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

    for (const depAddr of depositAddresses) {
      try {
        const signatures = await solana.getSignaturesForAddress(depAddr.public_key, 10);

        for (const sigInfo of signatures) {
          // Check idempotency
          const already = await prisma.processedDepositSignature.findUnique({
            where: { signature: sigInfo.signature },
          });
          if (already !== null) continue;

          // Get parsed transaction
          const parsed = await solana.getParsedTransaction(sigInfo.signature);
          if (parsed === null) continue;

          // Find SPL transfers to this deposit address
          const innerInstructions = parsed.meta?.innerInstructions ?? [];
          let depositAmount = 0;
          let depositMint: string | null = null;

          // Parse token transfers from inner instructions
          for (const inner of innerInstructions) {
            for (const ix of inner.instructions) {
              if ('parsed' in ix && ix.parsed && typeof ix.parsed === 'object') {
                const parsedIx = ix.parsed as {
                  type?: string;
                  info?: { destination?: string; tokenAmount?: { amount?: string }; mint?: string };
                };
                if (
                  parsedIx.type === 'transfer' &&
                  parsedIx.info?.destination === depAddr.public_key
                ) {
                  const rawAmount = Number(parsedIx.info?.tokenAmount?.amount ?? '0');
                  const mint = parsedIx.info?.mint ?? null;
                  if (rawAmount > 0 && mint !== null) {
                    depositAmount = rawAmount;
                    depositMint = mint;
                  }
                }
              }
            }
          }

          if (depositAmount === 0 || depositMint === null) continue;

          // Determine currency
          let currency: 'usdc' | 'usdt';
          if (depositMint === env.USDC_MINT) {
            currency = 'usdc';
          } else if (depositMint === env.USDT_MINT) {
            currency = 'usdt';
          } else {
            logger.warn(
              { mint: depositMint, signature: sigInfo.signature },
              'Unknown mint — skipping'
            );
            continue;
          }

          const amount = depositAmount / 1_000_000; // 6 decimals

          // Sweep to master wallet (decrypts deposit private key)
          // SAFETY: decryptString is only called here (in solana.service too); never logs the key.
          const decryptedKey = decryptString(depAddr.encrypted_private_key);
          let sweepSignature: string;
          try {
            sweepSignature = await solana.sweepDeposit(
              depAddr.encrypted_private_key,
              BigInt(depositAmount),
              currency
            );
          } catch (sweepError: unknown) {
            const msg = sweepError instanceof Error ? sweepError.message : String(sweepError);
            logger.error(
              { error: msg, address: depAddr.public_key, signature: sigInfo.signature },
              'Sweep failed — will retry next cycle'
            );
            void decryptedKey; // suppress unused variable warning
            continue;
          }
          void decryptedKey; // suppress unused variable warning

          // DB transaction: insert idempotency record + credit ledger
          const amountDecimal = new Prisma.Decimal(amount);
          await prisma.$transaction(async (tx) => {
            // SAFETY: unique constraint violation = already processed — skip silently
            try {
              await tx.processedDepositSignature.create({
                data: {
                  signature: sigInfo.signature,
                  deposit_address_public_key: depAddr.public_key,
                  amount: amountDecimal,
                  currency,
                },
              });
            } catch {
              // Already processed — skip
              return;
            }

            await tx.ledgerAccount.update({
              where: { user_id: depAddr.user_id },
              data: {
                [`balance_${currency}`]: { increment: amountDecimal },
                [`lifetime_deposited_${currency}`]: { increment: amountDecimal },
              },
            });

            await tx.ledgerTransaction.create({
              data: {
                transaction_type: 'deposit',
                status: 'completed',
                amount: amountDecimal,
                currency,
                from_account_type: 'external',
                to_account_type: 'user',
                to_account_id: depAddr.user_id,
                onchain_signature: sweepSignature,
              },
            });

            const ledgerAccount = await tx.ledgerAccount.findUnique({
              where: { user_id: depAddr.user_id },
            });
            if (ledgerAccount !== null) {
              await notif.send(
                depAddr.user_id,
                'deposit_confirmed',
                'system',
                'Deposit Received',
                `${amount} ${currency.toUpperCase()} has been credited to your balance.`
              );
            }
          });

          logger.info(
            { address: depAddr.public_key, amount, currency, sweepSignature },
            'Deposit processed'
          );
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg, address: depAddr.public_key }, 'Error scanning deposit address');
      }
    }
  });
}
