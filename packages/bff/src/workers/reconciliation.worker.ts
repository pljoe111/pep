/**
 * ReconciliationWorker — hourly reconciliation job. Spec §10.6.
 * Option B: compares sum of all unified ledger balances against combined
 * USDC + USDT on-chain balance of master wallet.
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

    // Internal total = SUM(ledger_account.balance) + SUM(campaign_escrow.balance) + fee_account.balance
    const [ledgerSum, escrowSum, feeAccount] = await Promise.all([
      prisma.ledgerAccount.aggregate({ _sum: { balance: true } }),
      prisma.campaignEscrow.aggregate({ _sum: { balance: true } }),
      prisma.feeAccount.findFirst(),
    ]);

    const ledgerTotal = Number(ledgerSum._sum?.balance ?? 0);
    const escrowTotal = Number(escrowSum._sum?.balance ?? 0);
    const feeTotal = feeAccount ? Number(feeAccount.balance) : 0;
    const internalTotal = ledgerTotal + escrowTotal + feeTotal;

    // On-chain total = master wallet USDC balance + master wallet USDT balance
    const [usdcOnchain, usdtOnchain] = await Promise.all([
      solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'usdc'),
      solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'usdt'),
    ]);
    const onchainTotal = (usdcOnchain + usdtOnchain) / 1_000_000; // convert raw → display

    const delta = Math.abs(internalTotal - onchainTotal);
    const threshold = 0.000001; // 1 micro unit tolerance

    if (delta > threshold) {
      const message = [
        'RECONCILIATION DISCREPANCY DETECTED',
        `Internal total: ${internalTotal}`,
        `On-chain total (USDC + USDT): ${onchainTotal}`,
        `  USDC on-chain: ${usdcOnchain / 1_000_000}`,
        `  USDT on-chain: ${usdtOnchain / 1_000_000}`,
        `Delta: ${delta}`,
        `Ledger accounts: ${ledgerTotal}`,
        `Campaign escrow: ${escrowTotal}`,
        `Fee account: ${feeTotal}`,
      ].join('\n');

      logger.error({ internalTotal, onchainTotal, delta }, 'Reconciliation discrepancy');
      await emailService.sendOperatorAlert('[ALERT] Reconciliation Discrepancy', message);
    } else {
      logger.info({ internalTotal, onchainTotal }, 'Reconciliation OK');
    }
  });
}
