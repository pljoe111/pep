/**
 * ConsolidationService — triggered by POST /admin/consolidate.
 * Safety-net only: primary currency normalization now happens at deposit ingress
 * (deposit-scanner.worker.ts swaps immediately on receipt).
 *
 * This service sweeps any residual USDC or PyUSD that was left on the master
 * wallet (e.g. from a failed swap at ingress that fell through on USDC fallback).
 * Swaps via Jupiter v6 API when the balance meets or exceeds the configured threshold.
 *
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

    // ── USDC safety-net sweep ──────────────────────────────────────────────────
    const usdcRaw = await this.solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'usdc');
    const usdcDisplay = usdcRaw / 1_000_000;

    let usdcTriggered = false;
    let usdcMessage: string;

    if (usdcDisplay < env.CONSOLIDATION_THRESHOLD_USDC) {
      logger.info(
        { usdcDisplay, threshold: env.CONSOLIDATION_THRESHOLD_USDC },
        'USDC balance below threshold — no USDC consolidation needed'
      );
      usdcMessage = `USDC balance (${usdcDisplay}) is below threshold (${env.CONSOLIDATION_THRESHOLD_USDC}). No swap performed.`;
    } else {
      logger.info(
        { usdcDisplay, threshold: env.CONSOLIDATION_THRESHOLD_USDC },
        'USDC balance above threshold — initiating Jupiter swap'
      );
      try {
        const { signature } = await this.solana.swapToUsdt(BigInt(usdcRaw), 'usdc');
        logger.info({ signature, usdcRaw }, 'USDC consolidation swap confirmed');
        usdcTriggered = true;
        usdcMessage = `Swapped ${usdcDisplay} USDC → USDT. On-chain signature: ${signature}`;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, usdcDisplay }, 'USDC consolidation swap failed');
        await this.email.sendOperatorAlert(
          '[ALERT] USDC Consolidation Swap Failed',
          `USDC→USDT Jupiter swap failed.\nUSCD balance: ${usdcDisplay}\nError: ${message}`
        );
        usdcMessage = `USDC consolidation failed: ${message}. Operator has been alerted.`;
      }
    }

    // ── PyUSD safety-net sweep ─────────────────────────────────────────────────
    const pyusdRaw = await this.solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'pyusd');
    const pyusdDisplay = pyusdRaw / 1_000_000;

    let pyusdTriggered = false;
    let pyusdMessage: string;

    if (pyusdDisplay < env.CONSOLIDATION_THRESHOLD_PYUSD) {
      logger.info(
        { pyusdDisplay, threshold: env.CONSOLIDATION_THRESHOLD_PYUSD },
        'PyUSD balance below threshold — no PyUSD consolidation needed'
      );
      pyusdMessage = `PyUSD balance (${pyusdDisplay}) is below threshold (${env.CONSOLIDATION_THRESHOLD_PYUSD}). No swap performed.`;
    } else {
      logger.info(
        { pyusdDisplay, threshold: env.CONSOLIDATION_THRESHOLD_PYUSD },
        'PyUSD balance above threshold — initiating Jupiter swap (permanent-delegate risk)'
      );
      try {
        const { signature } = await this.solana.swapToUsdt(BigInt(pyusdRaw), 'pyusd');
        logger.info({ signature, pyusdRaw }, 'PyUSD consolidation swap confirmed');
        pyusdTriggered = true;
        pyusdMessage = `Swapped ${pyusdDisplay} PyUSD → USDT. On-chain signature: ${signature}`;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, pyusdDisplay }, 'PyUSD consolidation swap failed');
        await this.email.sendOperatorAlert(
          '[ALERT] PyUSD Consolidation Swap Failed',
          `PyUSD→USDT Jupiter swap failed.\nPyUSD balance: ${pyusdDisplay}\nError: ${message}`
        );
        pyusdMessage = `PyUSD consolidation failed: ${message}. Operator has been alerted.`;
      }
    }

    return {
      triggered: usdcTriggered || pyusdTriggered,
      message: [usdcMessage, pyusdMessage].join(' | '),
      pyusd_triggered: pyusdTriggered,
      pyusd_message: pyusdMessage,
    };
  }
}
