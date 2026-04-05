/**
 * DI container setup. All tsyringe registrations go here ONLY (coding rules §3.4).
 * Also starts all background workers and jobs.
 */
import 'reflect-metadata';
import { container } from 'tsyringe';

// ─── Services ────────────────────────────────────────────────────────────────

import { PrismaService } from './services/prisma.service';
import { AuditService } from './services/audit.service';
import { ConfigurationService } from './services/configuration.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { WalletService } from './services/wallet.service';
import { NotificationService } from './services/notification.service';
import { LabService } from './services/lab.service';
import { TestService } from './services/test.service';
import { PeptideService } from './services/peptide.service';
import { VendorService } from './services/vendor.service';
import { LeaderboardService } from './services/leaderboard.service';
import { ContributionService } from './services/contribution.service';
import { SolanaService } from './services/solana.service';
import { StorageService } from './services/storage.service';
import { OcrService } from './services/ocr.service';
import { CoaService } from './services/coa.service';
import { CampaignService } from './services/campaign.service';
import { EmailService } from './services/email.service';
import { AdminService } from './services/admin.service';
import { ConsolidationService } from './workers/consolidation.worker';

container.registerSingleton(PrismaService);
container.registerSingleton(AuditService);
container.registerSingleton(ConfigurationService);
container.registerSingleton(AuthService);
container.registerSingleton(UserService);
container.registerSingleton(WalletService);
container.registerSingleton(NotificationService);
container.registerSingleton(LabService);
container.registerSingleton(TestService);
container.registerSingleton(PeptideService);
container.registerSingleton(VendorService);
container.registerSingleton(LeaderboardService);
container.registerSingleton(ContributionService);
container.registerSingleton(SolanaService);
container.registerSingleton(StorageService);
container.registerSingleton(OcrService);
container.registerSingleton(CoaService);
container.registerSingleton(CampaignService);
container.registerSingleton(EmailService);
container.registerSingleton(AdminService);
container.registerSingleton(ConsolidationService);

// ─── Workers & Jobs ───────────────────────────────────────────────────────────
// Only started in production/development (not during test runs or tsc type checking)

if (process.env.NODE_ENV !== 'test' && typeof process !== 'undefined') {
  // Lazy imports to avoid circular instantiation during module load
  // Workers and jobs are started after the container is wired up.
  const startWorkers = (): void => {
    // Dynamic requires are intentional here — these modules need the container
    // to be fully initialized before they access services via container.resolve().
    void import('./workers/withdrawal.worker').then(({ startWithdrawalWorker }) => {
      startWithdrawalWorker();
    });
    void import('./workers/deposit-scanner.worker').then(({ startDepositScannerWorker }) => {
      startDepositScannerWorker();
    });
    void import('./workers/ocr.worker').then(({ startOcrWorker }) => {
      startOcrWorker();
    });
    void import('./workers/email.worker').then(({ startEmailWorker }) => {
      startEmailWorker();
    });
    void import('./workers/reconciliation.worker').then(({ startReconciliationWorker }) => {
      startReconciliationWorker();
    });
    void import('./jobs/deadline-monitor.job').then(({ startDeadlineMonitorJob }) => {
      startDeadlineMonitorJob();
    });
    void import('./jobs/refresh-token-cleanup.job').then(({ startRefreshTokenCleanupJob }) => {
      startRefreshTokenCleanupJob();
    });
  };

  // Defer worker start to next tick so module graph is complete
  setImmediate(startWorkers);
}

export { container };
