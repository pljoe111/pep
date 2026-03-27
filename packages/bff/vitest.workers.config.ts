/**
 * Vitest configuration for the on/off-ramp worker test suite.
 *
 * Run this config separately from the main integration suite:
 *
 *   pnpm --filter bff vitest run --config vitest.workers.config.ts
 *
 * ─── Why separate? ────────────────────────────────────────────────────────────
 * The worker tests in src/workers/__tests__/ and the SolanaService unit tests
 * in src/services/__tests__/solana.service.test.ts:
 *   - Mock Bull queues (capturing process/failed callbacks) instead of mocking them away.
 *   - Mock @solana/web3.js and @solana/spl-token for SolanaService unit tests.
 *   - Require a real Redis instance for potential future "live Bull" variants.
 *   - Would conflict with the existing suite's module registry if merged into the
 *     same Vitest process (container singleton collisions, different vi.mock profiles).
 *
 * ─── Infrastructure required before running ──────────────────────────────────
 * See ON-OFF-RAMP-TEST-PLAN.md §1 for the full dependency table. At minimum:
 *
 *   1. PostgreSQL `test` database (same as the main suite).
 *   2. Redis server:  redis-server  (or docker run -p 6379:6379 redis:alpine)
 *
 * For the §3–5 "live Solana" variant (currently skipped — workers mock SolanaService):
 *   3. solana-test-validator --reset --quiet
 *   4. USDC/USDT test mints deployed (see §1 spl-token commands).
 *   5. Master wallet funded with SOL and USDC/USDT ATAs created.
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 * In addition to the variables required by the main suite, set:
 *
 *   SOLANA_RPC_URL=http://localhost:8899
 *   SOLANA_NETWORK=testnet
 *   USDC_MINT=<local-validator-mint-address>
 *   USDT_MINT=<local-validator-mint-address>
 *   MASTER_WALLET_PUBLIC_KEY=<base58>
 *   MASTER_WALLET_PRIVATE_KEY=<base58>
 *   REDIS_URL=redis://localhost:6379
 *
 * ─── Global setup (live-validator variant) ───────────────────────────────────
 * When the full live-validator suite is needed, add a globalSetup script:
 *
 *   globalSetup: ['./src/workers/__tests__/setup/start-validator.ts']
 *
 * The setup script should:
 *   1. Spawn `solana-test-validator --reset --quiet` and poll getVersion() until ready.
 *   2. Airdrop 10 SOL to MASTER_WALLET_PUBLIC_KEY.
 *   3. Deploy USDC and USDT test mints via `spl-token create-token`.
 *   4. Create and fund master wallet ATAs.
 *   5. Export mint addresses to process.env for the test run.
 *   6. On teardown, kill the validator process.
 *
 * The current tests do NOT require globalSetup because SolanaService is mocked.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Include only the worker tests and the SolanaService unit tests.
    // The main suite (vitest.config.ts) picks up everything else.
    include: [
      'src/workers/__tests__/**/*.test.ts',
      'src/services/__tests__/solana.service.test.ts',
    ],

    // Sequential execution — worker tests share a single PostgreSQL `test` DB and
    // the tsyringe container singleton; concurrent files would cause state collisions.
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },

    // Use a Redis key prefix per VITEST_WORKER_ID to isolate Bull queues in future
    // live-Redis variants. The current suite mocks queues, so this is a no-op there.
    // env: { BULL_PREFIX: `test:${process.env.VITEST_WORKER_ID ?? '0'}` },

    setupFiles: ['reflect-metadata'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/workers/deposit-scanner.worker.ts',
        'src/workers/withdrawal.worker.ts',
        'src/workers/reconciliation.worker.ts',
        'src/services/solana.service.ts',
      ],
      exclude: ['node_modules/', 'dist/', 'src/generated/'],
    },
  },
});
