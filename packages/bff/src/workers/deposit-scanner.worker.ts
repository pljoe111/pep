/**
 * DepositScannerWorker — scans all deposit addresses for incoming SPL transfers.
 * Spec §7.4. Frequency: 30 seconds, concurrency 1.
 *
 * FIX (mainnet): SPL token transfers go to the Associated Token Account (ATA)
 * of the deposit wallet, NOT to the wallet address itself.
 * We scan the ATA address via getSignaturesForAddress and detect amounts using
 * meta.postTokenBalances - meta.preTokenBalances (works for both outer and
 * inner instruction transfers, no instruction parsing needed).
 *
 * Option B: credits single unified balance field (currency still recorded on LedgerTransaction).
 */
import pino from 'pino';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { container } from '../container';
import { depositScannerQueue } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { SolanaService } from '../services/solana.service';
import { NotificationService } from '../services/notification.service';
import { env } from '../config/env.config';
import { Prisma } from '@prisma/client';
import { decryptString } from '../utils/crypto.util';

const logger = pino({ name: 'DepositScannerWorker' });

type SupportedCurrency = 'usdc' | 'usdt';

const CURRENCY_MINTS: Record<SupportedCurrency, string> = {
  usdc: env.USDC_MINT,
  usdt: env.USDT_MINT,
};

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

    for (const depAddr of depositAddresses) {
      // Scan the ATA for each supported currency separately.
      // On Solana, SPL transfers go to the ATA, not the wallet address itself.
      for (const currency of ['usdc', 'usdt'] as const) {
        const mintAddress = CURRENCY_MINTS[currency];

        try {
          // Derive the ATA for this currency — wrap PublicKey parse for safety
          const ownerPubkey = new PublicKey(depAddr.public_key);
          const mintPubkey = new PublicKey(mintAddress);
          const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
          const ataAddress = ata.toBase58();

          // Get recent signatures for the ATA (returns [] if ATA doesn't exist yet)
          const signatures = await solana.getSignaturesForAddress(ataAddress, 10);

          for (const sigInfo of signatures) {
            // --- Idempotency guard ---
            const already = await prisma.processedDepositSignature.findUnique({
              where: { signature: sigInfo.signature },
            });
            if (already !== null) continue;

            // --- Parse transaction ---
            const parsed = await solana.getParsedTransaction(sigInfo.signature);
            if (parsed === null) continue;

            // --- Detect incoming amount via token balance diff ---
            // This works for ALL transfer instruction types (outer, inner, transferChecked, etc.)
            const preBal = parsed.meta?.preTokenBalances?.find(
              (tb) => tb.owner === depAddr.public_key && tb.mint === mintAddress
            );
            const postBal = parsed.meta?.postTokenBalances?.find(
              (tb) => tb.owner === depAddr.public_key && tb.mint === mintAddress
            );

            const preRaw = BigInt(preBal?.uiTokenAmount?.amount ?? '0');
            const postRaw = BigInt(postBal?.uiTokenAmount?.amount ?? '0');
            const delta = postRaw - preRaw;

            if (delta <= 0n) continue; // Outgoing or unrelated

            const depositAmount = delta; // raw micro-units
            const amount = Number(depositAmount) / 1_000_000; // display units

            // --- Sweep to master wallet ---
            const decryptedKey = decryptString(depAddr.encrypted_private_key);
            let sweepSignature: string;
            try {
              sweepSignature = await solana.sweepDeposit(
                depAddr.encrypted_private_key,
                depositAmount,
                currency
              );
            } catch (sweepError: unknown) {
              const msg = sweepError instanceof Error ? sweepError.message : String(sweepError);
              logger.error(
                { error: msg, address: depAddr.public_key, signature: sigInfo.signature, currency },
                'Sweep failed — will retry next cycle'
              );
              void decryptedKey;
              continue;
            }
            void decryptedKey;

            // --- Credit unified ledger balance ---
            const amountDecimal = new Prisma.Decimal(amount);
            await prisma.$transaction(async (tx) => {
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
                // Already processed (race) — skip silently
                return;
              }

              // Option B: increment single unified balance
              await tx.ledgerAccount.update({
                where: { user_id: depAddr.user_id },
                data: {
                  balance: { increment: amountDecimal },
                  lifetime_deposited: { increment: amountDecimal },
                },
              });

              await tx.ledgerTransaction.create({
                data: {
                  transaction_type: 'deposit',
                  status: 'completed',
                  amount: amountDecimal,
                  currency, // currency still tracked for audit
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
              { address: depAddr.public_key, ataAddress, amount, currency, sweepSignature },
              'Deposit processed'
            );
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.error(
            { error: msg, address: depAddr.public_key, currency },
            'Error scanning deposit ATA'
          );
        }
      }
    }
  });
}
