/**
 * ConsolidationService — triggered by POST /admin/consolidate.
 * Swaps USDC → USDT via Jupiter v6 API if the master wallet's USDC balance
 * meets or exceeds env.CONSOLIDATION_THRESHOLD_USDC (default 100 display units).
 * On any error: logs + sends operator alert. Never touches ledger balances.
 * Audit log: action = 'admin.consolidation_triggered'.
 */
import { injectable, inject } from 'tsyringe';
import pino from 'pino';
import { SolanaService } from '../services/solana.service';
import { AuditService } from '../services/audit.service';
import { EmailService } from '../services/email.service';
import { env } from '../config/env.config';
import type { ConsolidationResponseDto } from 'common';

const logger = pino({ name: 'ConsolidationService' });

@injectable()
export class ConsolidationService {
  constructor(
    @inject(SolanaService) private readonly solana: SolanaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(EmailService) private readonly email: EmailService
  ) {}

  async consolidate(adminUserId: string): Promise<ConsolidationResponseDto> {
    // Audit log fire-and-forget (must not block or roll back business logic)
    this.audit.log({
      userId: adminUserId,
      action: 'admin.consolidation_triggered',
      entityType: 'fee_account',
      entityId: adminUserId,
    });

    // Check master wallet USDC balance (raw units from getTokenBalance)
    const usdcRaw = await this.solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'usdc');
    const usdcDisplay = usdcRaw / 1_000_000;

    if (usdcDisplay < env.CONSOLIDATION_THRESHOLD_USDC) {
      logger.info(
        { usdcDisplay, threshold: env.CONSOLIDATION_THRESHOLD_USDC },
        'USDC balance below threshold — no consolidation needed'
      );
      return {
        triggered: false,
        message: `USDC balance (${usdcDisplay}) is below threshold (${env.CONSOLIDATION_THRESHOLD_USDC}). No swap performed.`,
      };
    }

    logger.info(
      { usdcDisplay, threshold: env.CONSOLIDATION_THRESHOLD_USDC },
      'USDC balance above threshold — initiating Jupiter swap'
    );

    try {
      const signature = await this.solana.swapUsdcToUsdt(BigInt(usdcRaw));
      logger.info({ signature, usdcRaw }, 'Consolidation swap confirmed');
      return {
        triggered: true,
        message: `Swapped ${usdcDisplay} USDC → USDT. On-chain signature: ${signature}`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, usdcDisplay }, 'Consolidation swap failed');

      // Operator alert — do NOT throw, do NOT touch ledger balances
      await this.email.sendOperatorAlert(
        '[ALERT] Consolidation Swap Failed',
        `USDC→USDT Jupiter swap failed.\nUSCD balance: ${usdcDisplay}\nError: ${message}`
      );

      return {
        triggered: false,
        message: `Consolidation failed: ${message}. Operator has been alerted.`,
      };
    }
  }
}
