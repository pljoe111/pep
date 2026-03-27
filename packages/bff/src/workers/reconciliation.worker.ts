/**
 * ReconciliationWorker — hourly reconciliation job. Spec §10.6.
 * Compares sum of all ledger balances against master wallet on-chain balance.
 * On discrepancy: log.error + operator alert. NEVER auto-correct.
 */
import pino from 'pino';
import { container } from '../container';
import { reconciliationQueue } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { SolanaService } from '../services/solana.service';
import { EmailService } from '../services/email.service';
import { env } from '../config/env.config';

const logger = pino({ name: 'ReconciliationWorker' });

export function startReconciliationWorker(): void {
  void reconciliationQueue.add(
    {},
    { repeat: { every: 60 * 60_000 }, jobId: 'reconciliation-repeatable' }
  );

  void reconciliationQueue.process(1, async () => {
    const prisma = container.resolve(PrismaService);
    const solana = container.resolve(SolanaService);
    const emailService = container.resolve(EmailService);

    for (const currency of ['usdc', 'usdt'] as const) {
      const field = `balance_${currency}` as const;

      // Sum all ledger accounts
      const ledgerSum = await prisma.ledgerAccount.aggregate({ _sum: { [field]: true } });
      const escrowSum = await prisma.campaignEscrow.aggregate({ _sum: { [field]: true } });
      const feeAccount = await prisma.feeAccount.findFirst();

      const ledgerTotal = Number(ledgerSum._sum[field] ?? 0);
      const escrowTotal = Number(escrowSum._sum[field] ?? 0);
      const feeTotal = feeAccount ? Number(feeAccount[field]) : 0;
      const internalTotal = ledgerTotal + escrowTotal + feeTotal;

      // On-chain balance
      const onchainBalance = await solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, currency);
      const onchainTotal = onchainBalance / 1_000_000; // convert from raw to display units

      const delta = Math.abs(internalTotal - onchainTotal);
      const threshold = 0.000001; // 1 micro unit tolerance

      if (delta > threshold) {
        const message = [
          `RECONCILIATION DISCREPANCY DETECTED — ${currency.toUpperCase()}`,
          `Internal total: ${internalTotal}`,
          `On-chain total: ${onchainTotal}`,
          `Delta: ${delta}`,
          `Ledger accounts: ${ledgerTotal}`,
          `Campaign escrow: ${escrowTotal}`,
          `Fee account: ${feeTotal}`,
        ].join('\n');

        logger.error(
          { currency, internalTotal, onchainTotal, delta },
          'Reconciliation discrepancy'
        );
        await emailService.sendOperatorAlert(
          `[ALERT] Reconciliation Discrepancy — ${currency.toUpperCase()}`,
          message
        );
      } else {
        logger.info({ currency, internalTotal, onchainTotal }, 'Reconciliation OK');
      }
    }
  });
}
