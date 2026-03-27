# On/Off-Ramp Test Plan — Solana SPL Token Flows

> **Scope**: [`deposit-scanner.worker.ts`](../src/workers/deposit-scanner.worker.ts),
> [`withdrawal.worker.ts`](../src/workers/withdrawal.worker.ts),
> [`solana.service.ts`](../src/services/solana.service.ts),
> [`reconciliation.worker.ts`](../src/workers/reconciliation.worker.ts)
>
> **Status**: not yet written. These are the tests this document specifies.
>
> **Why they are separate from the existing suite**: All currently passing tests mock `queue.util`
> (preventing Bull/Redis) and never touch `SolanaService`. These flows require a live Solana
> local validator and funded SPL token accounts, which cannot share the same Vitest process as
> the PostgreSQL integration tests.

---

## 1. CI Infrastructure Required

Before any test in this plan can run, the following must be available in the test environment:

| Dependency                     | How to provide                                                  |
| ------------------------------ | --------------------------------------------------------------- |
| Solana local validator         | `solana-test-validator --reset` (or devnet)                     |
| SOL for fee payer              | `solana airdrop 10 <MASTER_WALLET_PUBLIC_KEY> --url localhost`  |
| USDC mint on local validator   | Deploy an SPL mint via `spl-token create-token`                 |
| USDT mint on local validator   | Deploy a second SPL mint                                        |
| Master wallet USDC ATA         | `spl-token create-account <USDC_MINT> --owner <MASTER_WALLET>`  |
| Master wallet USDT ATA         | Same for USDT                                                   |
| Master wallet funded with USDC | `spl-token mint <USDC_MINT> 10000 <MASTER_WALLET_ATA>`          |
| Master wallet funded with USDT | Same                                                            |
| PostgreSQL `test` DB           | Already provisioned by the existing suite                       |
| Redis                          | `redis-server` (Bull queues need a real Redis for worker tests) |

**Environment variables for these tests** (in addition to the existing set):

```env
SOLANA_RPC_URL=http://localhost:8899
SOLANA_NETWORK=testnet            # arbitrary; local validator has no network label
USDC_MINT=<local-mint-address>
USDT_MINT=<local-mint-address>
MASTER_WALLET_PUBLIC_KEY=<base58>
MASTER_WALLET_PRIVATE_KEY=<base58>
REDIS_URL=redis://localhost:6379
```

---

## 2. Test File Layout

```
packages/bff/src/workers/__tests__/
├── deposit-scanner.worker.test.ts   # on-ramp: scanning, sweep, ledger credit
├── withdrawal.worker.test.ts        # off-ramp: execution, confirmation, failure recovery
└── reconciliation.worker.test.ts    # balance invariant check
```

Each file uses **real SolanaService** (connects to `solana-test-validator`) and **real PrismaService**
(connects to the `test` PostgreSQL database). Bull is real (connects to Redis).

---

## 3. Deposit Scanner (`deposit-scanner.worker.ts`)

### 3.1 Happy path — USDC deposit detected and credited

**Setup (direct DB writes + on-chain)**:

1. Create test user, ledger account (balance = 0), deposit address row in DB.
2. Fund the deposit address's SPL USDC token account on-chain with `100_000_000` raw units (100 USDC).
3. Send an SPL transfer of `50_000_000` raw units from the deposit address to itself (to generate a confirmsignature). _Or: use `solana.sweepDeposit()` helper in test to simulate an actual incoming transfer._

**What to actually do**: The worker scans `getSignaturesForAddress` and processes any transfer instruction whose `destination === depAddr.public_key`. The simplest setup is:

- Use a third "sender" keypair.
- Fund sender with USDC.
- Sender transfers `50_000_000` raw units to the deposit address.
- Run one worker tick.

**Assertions**:

- `LedgerAccount.balance_usdc.toString()` === `'50'`
- `LedgerAccount.lifetime_deposited_usdc.toString()` === `'50'`
- `LedgerAccount.balance_usdt.toString()` === `'0'` (untouched)
- `ProcessedDepositSignature` row created with correct `signature`, `amount`, `currency`
- `LedgerTransaction` row: `transaction_type = 'deposit'`, `status = 'completed'`, `amount = '50'`, `currency = 'usdc'`, `onchain_signature` non-null
- Master wallet USDC on-chain balance increased by 50 (sweep succeeded)

### 3.2 Happy path — USDT deposit credited

Same as 3.1 but uses USDT mint. Asserts `balance_usdt` credited, USDC fields untouched.

### 3.3 Idempotency — same signature processed twice

**Setup**: Run one worker tick; call it again without any new on-chain activity.

**Assertions**:

- `ProcessedDepositSignature` count for that signature remains exactly `1`
- `LedgerAccount.balance_usdc` remains `50` (not doubled)
- No duplicate `LedgerTransaction` rows

### 3.4 Unknown mint ignored

**Setup**: Send a transfer using a third SPL mint (not USDC or USDT) to the deposit address.

**Assertions**:

- No `ProcessedDepositSignature` row created
- `LedgerAccount` balances unchanged
- No `LedgerTransaction` row created

### 3.5 Sweep fails — deposit not credited

**Setup**: Mock `SolanaService.sweepDeposit` to throw. Run worker tick.

**Assertions**:

- No `ProcessedDepositSignature` row created (idempotency guard not written on sweep failure)
- `LedgerAccount` balance unchanged (balance never credited before successful sweep)
- Signature is NOT in `processedDepositSignature` — next scan will retry it

### 3.6 Zero-amount transfer ignored

**Setup**: Manufacture a parsed transaction whose `tokenAmount.amount` is `'0'`.

**Assertions**:

- Worker continues to next signature without inserting any rows

### 3.7 Amount conversion accuracy — 6 decimal places

**Setup**: Transfer `1` raw unit (0.000001 USDC).

**Assertions**:

- `LedgerAccount.balance_usdc.toString()` === `'0.000001'`
- `LedgerTransaction.amount.toString()` === `'0.000001'`

---

## 4. Withdrawal Worker (`withdrawal.worker.ts`)

> **Note**: `WalletService.requestWithdrawal()` is already tested by
> [`wallet.service.test.ts`](../__tests__/wallet.service.test.ts). This section covers everything
> downstream — what happens after the job is enqueued.

### 4.1 Happy path — USDC withdrawal confirmed on-chain

**Setup**:

1. Seed user with `LedgerAccount.balance_usdc = 0` (already debited by requestWithdrawal).
2. Insert a `pending` `LedgerTransaction` row directly in DB (type `withdrawal`, amount `'10'`, currency `usdc`, `external_address = <destination_pubkey>`, `from_account_id = userId`).
3. Enqueue a job `{ ledger_transaction_id }` to `withdrawalQueue`.

**Assertions (after worker processes the job)**:

- `LedgerTransaction.status` === `'confirmed'`
- `LedgerTransaction.onchain_signature` is a non-empty string
- Destination USDC ATA on-chain balance increased by `10_000_000` raw units (10 USDC)
- Master wallet USDC on-chain balance decreased by `10_000_000` raw units

### 4.2 Happy path — USDT withdrawal confirmed

Same as 4.1 but currency `usdt`.

### 4.3 Idempotency — `onchain_signature` already set, transaction already landed

**Setup**: Pre-set `onchain_signature` on a `pending` LedgerTransaction to a real signature that was already confirmed on-chain. Enqueue a job.

**Assertions**:

- `LedgerTransaction.status` updated to `'confirmed'`
- No duplicate SPL transfer sent (the existing signature is found by `getTransaction()`)
- Destination balance unchanged (transfer did not happen twice)

### 4.4 Idempotency — transaction not found or not pending (already confirmed)

**Setup**: Insert a `LedgerTransaction` with `status = 'confirmed'`. Enqueue a job.

**Assertions**:

- Worker returns early (logs warn, does nothing)
- `LedgerTransaction.status` remains `'confirmed'` — no state change

### 4.5 Permanent on-chain failure — balance restored

**Setup**:

1. Seed user with `LedgerAccount.balance_usdc = 0`, `lifetime_withdrawn_usdc = 10`.
2. Insert `pending` `LedgerTransaction` for 10 USDC.
3. Mock `SolanaService.executeWithdrawal` to throw on all attempts.
4. Configure Bull job with `attempts: 1` so it goes straight to permanent failure.

**Assertions (after `failed` event fires)**:

- `LedgerAccount.balance_usdc.toString()` === `'10'` (restored)
- `LedgerAccount.lifetime_withdrawn_usdc.toString()` === `'0'` (decremented back)
- `LedgerTransaction.status` === `'failed'`

### 4.6 Balance not restored when `from_account_id` is null (fee sweep path)

**Setup**: Insert `pending` `LedgerTransaction` with `from_account_id = null`. Configure to fail.

**Assertions**:

- No `LedgerAccount` update attempted
- `LedgerTransaction.status` === `'failed'`

### 4.7 Amount conversion accuracy — raw unit calculation

`amount = BigInt(Math.round(Number(ledgerTx.amount) * 1_000_000))`

| DB amount       | Expected raw `bigint` | Expected on-chain lamports |
| --------------- | --------------------- | -------------------------- |
| `'10.500000'`   | `10_500_000n`         | `10_500_000`               |
| `'0.000001'`    | `1n`                  | `1`                        |
| `'1000.123456'` | `1_000_123_456n`      | `1_000_123_456`            |

**Assertions**: Verify `SolanaService.executeWithdrawal` is called with the exact `bigint` value, then check destination on-chain balance matches.

---

## 5. Reconciliation Worker (`reconciliation.worker.ts`)

### 5.1 Balanced state — no alert sent

**Setup**:

1. Seed `LedgerAccount` rows summing to 150 USDC.
2. Seed `CampaignEscrow` rows summing to 50 USDC.
3. Set `FeeAccount.balance_usdc` = 0.
4. Ensure master wallet on-chain USDC balance = `200_000_000` raw units (200 USDC).

**Assertions**:

- `EmailService.sendOperatorAlert` NOT called
- No error logged (check Pino log spy)

### 5.2 Discrepancy > threshold — operator alert sent

**Setup**: Same as 5.1 but set master wallet on-chain balance to 201 USDC (1 USDC over).

**Assertions**:

- `EmailService.sendOperatorAlert` called once
- Alert subject contains `'USDC'`
- Alert body contains the delta value
- No DB mutation performed (worker never auto-corrects)
- `LedgerAccount`, `CampaignEscrow`, `FeeAccount` all unchanged

### 5.3 Sub-threshold delta — no alert (tolerance = 0.000001)

**Setup**: On-chain balance is `200.0000005` USDC (delta = 0.0000005, below threshold).

**Assertions**:

- `EmailService.sendOperatorAlert` NOT called

### 5.4 USDC and USDT checked independently

**Setup**: USDC balanced; USDT discrepant by 5.

**Assertions**:

- `sendOperatorAlert` called exactly once
- Alert body references `'USDT'` not `'USDC'`

### 5.5 Zero balances everywhere — no alert

**Setup**: All ledger rows = 0. On-chain balance = 0.

**Assertions**:

- `sendOperatorAlert` NOT called

---

## 6. `SolanaService` unit tests (mocked RPC)

These do not need a local validator. They verify the service's own logic against a
stubbed `@solana/web3.js` `Connection`.

| Test                                                     | What the mock returns                                                        | What to assert                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `sweepDeposit` — success                                 | `getLatestBlockhash`, `sendRawTransaction`, `confirmTransaction` all succeed | Returns a non-empty signature string                        |
| `sweepDeposit` — `sendRawTransaction` throws             | RPC throws `SendTransactionError`                                            | `sweepDeposit` propagates the error                         |
| `executeWithdrawal` — success                            | Same happy path mocks                                                        | Returns a non-empty signature string                        |
| `executeWithdrawal` — destination ATA creation fails     | `getOrCreateAssociatedTokenAccount` throws                                   | `executeWithdrawal` propagates error (worker retry path)    |
| `getSignaturesForAddress`                                | Returns 2 `ConfirmedSignatureInfo` entries                                   | Returns exactly those 2 entries                             |
| `getTokenBalance` — ATA exists                           | `getTokenAccountBalance` returns `{ uiAmount: 150.5 }`                       | Returns `150.5 * 10^6`                                      |
| `getTokenBalance` — ATA does not exist                   | `getAssociatedTokenAddress` or `getTokenAccountBalance` throws               | Returns `0` (error swallowed, warn logged)                  |
| Amount precision: `executeWithdrawal` with `1n` raw unit | Succeeds                                                                     | Transaction contains transfer of exactly `1` lamport of SPL |

---

## 7. Implementation Notes

### Mocking strategy for the worker tests

Unlike the existing integration tests, the worker functions (`startDepositScannerWorker`,
`startWithdrawalWorker`) are imperative — they call `container.resolve(...)` internally.
The test approach should be one of:

**Option A — replace container registrations before starting the worker**:

```typescript
container.registerInstance(SolanaService, mockSolanaService);
container.registerInstance(PrismaService, realPrismaService);
startDepositScannerWorker(); // now uses the injected mocks
```

**Option B — extract pure functions** (recommended for long term):
Refactor the worker's inner logic into an exported `processDeposit(prisma, solana, notif, depAddr, sigInfo)` helper that can be unit-tested directly without Bull. This is the cleanest separation.

### Bull queue isolation

Use a dedicated Redis key prefix per test run to avoid job collision:

```typescript
const queue = new Bull('test-deposit-scanner', {
  redis: env.REDIS_URL,
  prefix: `test:${process.env.VITEST_WORKER_ID}`,
});
```

### `solana-test-validator` startup

Add a `globalSetup` script in `vitest.config.ts` for these tests only:

```typescript
globalSetup: ['./src/workers/__tests__/setup/start-validator.ts'];
```

The script should:

1. Spawn `solana-test-validator --reset --quiet`.
2. Wait for RPC to be ready (`getVersion()` poll).
3. Airdrop SOL to master wallet.
4. Deploy USDC and USDT test mints.
5. Fund master wallet ATAs.
6. Export mint addresses to `process.env` for the test run.
7. On teardown, kill the validator process.

### Decimal assertion rule

Identical to the existing suite — all monetary comparisons use `.toString()`, never `.toNumber()`:

```typescript
expect(account.balance_usdc.toString()).toBe('50'); // correct
expect(Number(account.balance_usdc)).toBe(50); // FORBIDDEN
```

---

## 8. Risk Areas and Edge Cases Summary

| Risk                                                                | Covered by test           | Section    |
| ------------------------------------------------------------------- | ------------------------- | ---------- |
| Deposit credited twice for same signature                           | 3.3 idempotency           | §3.3       |
| Unknown SPL mint silently accepted                                  | 3.4 unknown mint ignored  | §3.4       |
| Sweep failure leaves balance in inconsistent state                  | 3.5 sweep fails           | §3.5       |
| Off-by-one in raw unit conversion (`× 1_000_000`)                   | 4.7, 3.7                  | §3.7, §4.7 |
| Withdrawal balance not restored on permanent failure                | 4.5                       | §4.5       |
| Fee sweep (null `from_account_id`) never restores balance           | 4.6                       | §4.6       |
| Reconciliation auto-corrects on discrepancy                         | 5.2 (asserts NO mutation) | §5.2       |
| Reconciliation fires alert below tolerance                          | 5.3                       | §5.3       |
| Withdrawal job retried with same signature sends duplicate transfer | 4.3 idempotency           | §4.3       |
