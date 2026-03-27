/**
 * Bull queue instances — created once at startup, shared across DI container.
 * All queues connect to Redis via env.REDIS_URL.
 * This is a pure util (no DI) per coding rules §3.1.
 */
import Bull from 'bull';
import { env } from '../config/env.config';

const redisOptions: Bull.QueueOptions = {
  redis: env.REDIS_URL,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
};

/** On-demand queue — enqueued after on-chain deposit detected */
export const withdrawalQueue = new Bull('withdrawal', redisOptions);

/** On-demand queue — enqueued after COA upload */
export const ocrQueue = new Bull('ocr', redisOptions);

/** On-demand queue — enqueued by NotificationService when email: true in prefs */
export const emailQueue = new Bull('email', redisOptions);

/** Repeatable — every 30 seconds, concurrency 1 (deposit scanning) */
export const depositScannerQueue = new Bull('deposit-scanner', redisOptions);

/** Repeatable — every 5 minutes, concurrency 1 */
export const deadlineMonitorQueue = new Bull('deadline-monitor', redisOptions);

/** Repeatable — every 1 hour */
export const reconciliationQueue = new Bull('reconciliation', redisOptions);

/** Repeatable — daily */
export const refreshTokenCleanupQueue = new Bull('refresh-token-cleanup', redisOptions);

// ─── Job payload types ────────────────────────────────────────────────────────

export interface WithdrawalJobPayload {
  ledger_transaction_id: string;
}

export interface OcrJobPayload {
  coa_id: string;
}

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}
