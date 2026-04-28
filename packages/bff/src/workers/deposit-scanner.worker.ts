/**
 * DepositScannerWorker — checks SPL token balances on all deposit ATAs each cycle.
 * Spec §7.4. Frequency: 30 seconds, concurrency 1.
 *
 * Strategy (balance-check, not signature-scan):
 *   1. Derive the USDC, USDT, and PyUSD ATA for every deposit address (pure math, no RPC).
 *   2. Call getMultipleAccountsInfo once per currency — ONE RPC call fetches all
 *      balances in a batch of up to 100 accounts per request.
 *   3. For any ATA whose raw balance > 0: sweep to master wallet, then:
 *        - USDT: credit 100% directly.
 *        - USDC/PyUSD: swap to USDT via Jupiter, apply 50 bps platform conversion fee,
 *          credit netCredit to user, credit feeRaw to fee_account.
 *      Sweep signature is the idempotency key (stored in processedDepositSignature).
 *
 * Option B: credits single unified balance field (currency still recorded on LedgerTransaction).
 *
 * PyUSD risk: Token-2022 permanent delegate — PayPal can move tokens from any account
 * without the owner's signature. Never hold PyUSD overnight. On swap failure:
 *   - PyUSD: do NOT credit (HIGH RISK). Retry next cycle.
 *   - USDC:  credit raw USDC as fallback; ConsolidationService safety-net cleans up.
 */
import pino from 'pino';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { Prisma, type Currency as PrismaCurrency } from '@prisma/client';
import { container } from '../container';
import { depositScannerQueue } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { SolanaService, type SupportedCurrency } from '../services/solana.service';
import { NotificationService } from '../services/notification.service';
import { env } from '../config/env.config';

const logger = pino({ name: 'DepositScannerWorker' });

const CURRENCY_MINTS: Record<SupportedCurrency, string> = {
  usdc: env.USDC_MINT,
  usdt: env.USDT_MINT,
  pyusd: env.PYUSD_MINT,
};

const DECIMALS = 6; // all supported stablecoins use 6 decimal places

// ─── Helper: read conversion fee bps from Configuration table ─────────────────

async function getConversionFeeBps(prisma: PrismaService): Promise<number> {
  const row = await prisma.configuration.findUnique({
    where: { config_key: 'deposit_conversion_fee_bps' },
  });
  if (row === null) return 50; // safe default: 50 bps
  const val = row.config_value;
  return typeof val === 'number' ? val : 50;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

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

    for (const currency of ['usdc', 'usdt', 'pyusd'] as const) {
      const mintAddress = CURRENCY_MINTS[currency];
      const mintPubkey = new PublicKey(mintAddress);
      // PyUSD uses Token-2022 program for ATA derivation
      const programId = currency === 'pyusd' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

      // Derive all ATAs for this currency (pure computation — no RPC calls)
      const ataAddresses = await Promise.all(
        depositAddresses.map(async (depAddr) => {
          const ownerPubkey = new PublicKey(depAddr.public_key);
          const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey, false, programId);
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

        // ─── Settlement normalization ──────────────────────────────────────────
        // USDT: credit as-is. USDC/PyUSD: swap to USDT → apply conversion fee.

        let creditAmountRaw: bigint; // USDT raw units to credit to user
        let swapSignature: string | null = null;
        let feeAmountRaw: bigint = 0n; // USDT raw units to credit to fee_account

        if (currency !== 'usdt') {
          try {
            const result = await solana.swapToUsdt(rawBalance, currency);
            swapSignature = result.signature;

            // Apply fixed conversion fee (sourced from Configuration table)
            const feeBps = BigInt(await getConversionFeeBps(prisma)); // e.g. 50n
            feeAmountRaw = (result.usdtReceived * feeBps) / 10_000n;
            creditAmountRaw = result.usdtReceived - feeAmountRaw;

            logger.info(
              {
                currency,
                depositRaw: rawBalance.toString(),
                usdtReceived: result.usdtReceived.toString(),
                feeRaw: feeAmountRaw.toString(),
                netCredit: creditAmountRaw.toString(),
              },
              'Deposit conversion complete'
            );
          } catch (swapErr: unknown) {
            const msg = swapErr instanceof Error ? swapErr.message : String(swapErr);
            logger.error(
              { error: msg, address: depAddr.public_key, currency },
              'Deposit swap failed'
            );

            if (currency === 'pyusd') {
              // HIGH RISK: PayPal permanent delegate. Do NOT credit. Retry next cycle.
              // The processedDepositSignature guard ensures no double-sweep on retry.
              logger.warn(
                { address: depAddr.public_key },
                'PyUSD swap failed — NOT crediting. Will retry next cycle.'
              );
              continue;
            }

            // USDC fallback: credit raw USDC; ConsolidationService safety-net cleans up.
            creditAmountRaw = rawBalance;
            feeAmountRaw = 0n;
            swapSignature = null;
            logger.warn(
              { address: depAddr.public_key },
              'USDC swap failed — crediting raw USDC amount as fallback'
            );
          }
        } else {
          // USDT: no conversion needed, no fee
          creditAmountRaw = rawBalance;
        }

        const amount = new Prisma.Decimal(creditAmountRaw.toString()).div(
          new Prisma.Decimal(10 ** DECIMALS)
        );
        const feeAmount = new Prisma.Decimal(feeAmountRaw.toString()).div(
          new Prisma.Decimal(10 ** DECIMALS)
        );

        // Credit unified ledger balance.
        // sweepSignature is the idempotency key — if the DB write was already
        // recorded from a previous (partially-failed) cycle, skip silently.
        await prisma.$transaction(
          async (tx) => {
            try {
              await tx.processedDepositSignature.create({
                data: {
                  signature: sweepSignature,
                  deposit_address_public_key: depAddr.public_key,
                  amount,
                  // Cast required until Prisma client is regenerated after the pyusd migration
                  currency: currency as PrismaCurrency,
                },
              });
            } catch {
              // Unique constraint violation — sweep already credited. Skip.
              return;
            }

            // Credit user unified balance
            await tx.ledgerAccount.update({
              where: { user_id: depAddr.user_id },
              data: {
                balance: { increment: amount },
                lifetime_deposited: { increment: amount },
              },
            });

            // Deposit ledger record — original currency for audit, USDT-equivalent net credit
            await tx.ledgerTransaction.create({
              data: {
                transaction_type: 'deposit',
                status: 'completed',
                amount, // USDT-equivalent net credit
                // Cast required until Prisma client is regenerated after the pyusd migration
                currency: currency as PrismaCurrency, // original deposited currency (audit trail)
                from_account_type: 'external',
                to_account_type: 'user',
                to_account_id: depAddr.user_id,
                onchain_signature: swapSignature ?? sweepSignature,
              },
            });

            // Conversion fee record (only when fee was applied)
            if (feeAmountRaw > 0n) {
              const feeAccount = await tx.feeAccount.findFirst();
              if (feeAccount !== null) {
                await tx.feeAccount.update({
                  where: { id: feeAccount.id },
                  data: { balance: { increment: feeAmount } },
                });
                await tx.ledgerTransaction.create({
                  data: {
                    transaction_type: 'fee',
                    status: 'completed',
                    amount: feeAmount,
                    currency: 'usdt', // fee is always settled in USDT
                    from_account_type: 'user',
                    from_account_id: depAddr.user_id,
                    to_account_type: 'fee',
                    to_account_id: feeAccount.id,
                    onchain_signature: swapSignature, // same swap tx
                  },
                });
              }
            }

            // Notification
            const currencyLabel = currency.toUpperCase();
            const depositDisplay = (Number(rawBalance) / 1e6).toFixed(2);
            const creditDisplay = amount.toFixed(2);
            const message =
              currency !== 'usdt'
                ? `${depositDisplay} ${currencyLabel} deposited and converted to ${creditDisplay} USDT at current market rate.`
                : `${creditDisplay} USDT has been credited to your balance.`;

            await notif.send(
              depAddr.user_id,
              'deposit_confirmed',
              'system',
              'Deposit Received',
              message
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        logger.info(
          {
            address: depAddr.public_key,
            ataAddress,
            amount: amount.toFixed(6),
            feeAmount: feeAmount.toFixed(6),
            currency,
            sweepSignature,
            swapSignature,
          },
          'Deposit processed'
        );
      }
    }
  });
}
