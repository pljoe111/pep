# Option B — Single Unified Balance

> **Status:** Approved design decision — pending implementation.
> Replaces the dual `balance_usdc` / `balance_usdt` model described in `system-spec-v3.md §4.4, §4.8, §4.9`.
> All other sections of `system-spec-v3.md` remain authoritative.

---

## 1. Decision Summary

| Topic                       | Old decision                                                   | New decision                                                                                                  |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Ledger balance fields       | `balance_usdc` + `balance_usdt` on every balance-holding table | Single `balance` field (USD-equivalent, 18/6 Decimal)                                                         |
| Withdrawal currency         | User selects USDC or USDT; worker sends that token             | Always USDT; `currency` field removed from `WithdrawDto`                                                      |
| Deposit accounting          | Credit the matching `balance_usdc` or `balance_usdt` field     | Credit single `balance` regardless of incoming token type                                                     |
| Audit trail                 | Currency inferred from balance field updated                   | `currency` column kept on `LedgerTransaction` and `ProcessedDepositSignature`                                 |
| Master wallet consolidation | N/A                                                            | New admin-triggered consolidation job swaps accumulated USDC→USDT via Jupiter when `USDC balance > threshold` |

---

## 2. Rationale

- Eliminates 4 schema columns across 3 tables (`LedgerAccount`, `CampaignEscrow`, `FeeAccount`).
- Removes every `if (currency === 'usdc') … else …` branch from contribution, payout, refund, and withdrawal service code.
- USDC and USDT are both USD-pegged stablecoins; treating them as fungible in the accounting layer introduces negligible economic risk.
- No real-time swap required at deposit or contribution time — sweep is unchanged.
- Withdrawals always send USDT, which is the dominant stablecoin. Master wallet USDT reserves are managed by an off-hours consolidation job.

---

## 3. Schema Changes

### 3.1 `LedgerAccount` (§4.4)

**Remove:**

```
balance_usdc            Decimal
balance_usdt            Decimal
lifetime_deposited_usdc Decimal
lifetime_deposited_usdt Decimal
lifetime_withdrawn_usdc Decimal
lifetime_withdrawn_usdt Decimal
```

**Add:**

```prisma
balance            Decimal  @default(0) @db.Decimal(18, 6)
lifetime_deposited Decimal  @default(0) @db.Decimal(18, 6)
lifetime_withdrawn Decimal  @default(0) @db.Decimal(18, 6)
```

**DB constraint (migration):**

```sql
ALTER TABLE ledger_account ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);
```

---

### 3.2 `CampaignEscrow` (§4.8)

**Remove:** `balance_usdc`, `balance_usdt`  
**Add:**

```prisma
balance Decimal @default(0) @db.Decimal(18, 6)
```

**DB constraint:**

```sql
ALTER TABLE campaign_escrow ADD CONSTRAINT escrow_balance_non_negative CHECK (balance >= 0);
```

---

### 3.3 `FeeAccount` (§4.9)

**Remove:** `balance_usdc`, `balance_usdt`  
**Add:**

```prisma
balance Decimal @default(0) @db.Decimal(18, 6)
```

---

### 3.4 Unchanged models

| Model                       | Currency field      | Kept?  | Reason                                                                |
| --------------------------- | ------------------- | ------ | --------------------------------------------------------------------- |
| `LedgerTransaction`         | `currency Currency` | ✅ Yes | Audit trail — records what token was actually moved on-chain          |
| `ProcessedDepositSignature` | `currency Currency` | ✅ Yes | Idempotency guard — token identity is part of the deposit fingerprint |
| `Contribution`              | `currency Currency` | ✅ Yes | Historical record of what the contributor held at contribution time   |

---

## 4. DTO Changes (`packages/common`)

### 4.1 `WalletBalanceDto`

```ts
// Before
interface WalletBalanceDto {
  balance_usdc: number;
  balance_usdt: number;
}

// After
interface WalletBalanceDto {
  balance: number;
}
```

### 4.2 `WithdrawDto`

```ts
// Before
class WithdrawDto {
  amount!: number;
  currency!: Currency; // ← remove
  destination_address!: string;
}

// After
class WithdrawDto {
  @IsNumber()
  @Min(0.000001)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  destination_address!: string;
}
```

### 4.3 `LedgerTransactionDto` — unchanged

`currency` field is kept for display in transaction history.

---

## 5. Service / Worker Changes

### 5.1 `deposit-scanner.worker.ts`

**Deposit processing loop — balance credit:**

```ts
// Before
[`balance_${currency}`]: { increment: amountDecimal },
[`lifetime_deposited_${currency}`]: { increment: amountDecimal },

// After
balance:            { increment: amountDecimal },
lifetime_deposited: { increment: amountDecimal },
```

`currency` is still detected from the on-chain mint and stored on `LedgerTransaction` and `ProcessedDepositSignature`. No other changes to this worker.

---

### 5.2 `contribution.service.ts`

**Balance check:**

```ts
// Before
const currencyBalance =
  dto.currency === 'usdc' ? Number(account.balance_usdc) : Number(account.balance_usdt);

// After
const currencyBalance = Number(account.balance);
```

**Balance debit (inside transaction):**

```ts
// Before
if (dto.currency === 'usdc') {
  await tx.ledgerAccount.update({ data: { balance_usdc: { decrement: amountDecimal } } });
} else {
  await tx.ledgerAccount.update({ data: { balance_usdt: { decrement: amountDecimal } } });
}

// After
await tx.ledgerAccount.update({ data: { balance: { decrement: amountDecimal } } });
```

**Escrow credit:**

```ts
// Before (separate usdc/usdt fields)
if (dto.currency === 'usdc') {
  balance_usdc: {
    increment;
  }
} else {
  balance_usdt: {
    increment;
  }
}

// After
balance: {
  increment: amountDecimal;
}
```

---

### 5.3 `campaign.service.ts` (payout and refund)

**Payout to creator:**

```ts
// Before: separate payoutUsdc / payoutUsdt increments on creator LedgerAccount

// After
await tx.ledgerAccount.update({
  where: { user_id: campaign.creator_id },
  data: { balance: { increment: totalPayout } },
});
```

`totalPayout` = total escrow balance minus fee.

**Refunds to contributors:**

```ts
// Before: per-currency increment

// After
await tx.ledgerAccount.update({
  where: { user_id: contribution.contributor_id },
  data: { balance: { increment: contribution.amount_usd } },
});
```

**Campaign escrow drain:**

```ts
// Before: zero out balance_usdc and balance_usdt

// After
await tx.campaignEscrow.update({ data: { balance: 0 } });
```

**Fee account credit:**

```ts
// Before: per-currency increment

// After
await tx.feeAccount.update({ data: { balance: { increment: feeAmount } } });
```

---

### 5.4 `wallet.service.ts`

**`getBalance`:**

```ts
// Before → { balance_usdc, balance_usdt }
// After  → { balance }
```

**`withdraw`:**

- Remove `currency` from `WithdrawDto` / method signature.
- Always use USDT mint for on-chain transfer.
- Balance field:

```ts
// Before: per-currency decrement

// After
await tx.ledgerAccount.update({
  data: {
    balance: { decrement: amountDecimal },
    lifetime_withdrawn: { increment: amountDecimal },
  },
});
```

---

### 5.5 `withdrawal.worker.ts` (rollback on failure)

```ts
// Before: per-currency increment on rollback

// After
await tx.ledgerAccount.update({
  data: {
    balance: { increment: ledgerTx.amount },
    lifetime_withdrawn: { decrement: ledgerTx.amount },
  },
});
```

On-chain withdrawal always sends USDT (mint resolved from `env.USDT_MINT`). The `currency` column on the `LedgerTransaction` row is set to `'usdt'` for all withdrawals.

---

### 5.6 `reconciliation.worker.ts`

**Current behaviour:** checks `balance_usdc` and `balance_usdt` in the master wallet against the sum of all `LedgerAccount.balance_usdc` / `balance_usdt`.

**New behaviour:** Check total USD value held across both tokens in the master wallet against the total of all internal balances:

```
expected_on_chain = SUM(ledger_account.balance)
                  + SUM(campaign_escrow.balance)
                  + fee_account.balance

actual_on_chain   = masterWallet.USDC_balance + masterWallet.USDT_balance
```

If `|actual_on_chain - expected_on_chain| > threshold` → send operator alert.

`getTokenBalance` on `SolanaService` is called twice (once per mint) and the results are summed — no interface change required.

---

## 6. New Component — Consolidation Job

| Field             | Value                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| Location          | `packages/bff/src/workers/consolidation.worker.ts`                                     |
| Trigger           | Admin API endpoint `POST /admin/consolidate` (admin claim required)                    |
| Purpose           | Swap accumulated USDC on the master wallet → USDT via Jupiter                          |
| Threshold env var | `CONSOLIDATION_THRESHOLD_USDC` (default `100` — only runs if USDC balance ≥ threshold) |
| On-chain          | Single Jupiter swap transaction; logs signature                                        |
| Error behaviour   | Log error, send operator alert — does NOT affect ledger balances                       |
| Audit             | `action: 'admin.consolidation_triggered'`                                              |

> **Note:** The consolidation job is an operational convenience, not a correctness requirement. Withdrawals succeed as long as the master wallet holds enough USDT. The job is triggered manually by ops, not automatically, to avoid adding an always-on DEX dependency.

---

## 7. API Contract Changes

### `GET /wallet/balance`

```jsonc
// Before
{ "balance_usdc": 12.5, "balance_usdt": 8.0 }

// After
{ "balance": 20.5 }
```

### `POST /wallet/withdraw`

```jsonc
// Before
{ "amount": 10, "currency": "usdt", "destination_address": "..." }

// After
{ "amount": 10, "destination_address": "..." }
```

Response unchanged: `{ ledger_transaction_id, status: "pending" }`.

---

## 8. Migration Strategy

1. Write a new Prisma migration that:
   - `ALTER TABLE ledger_account` — rename or replace `balance_usdc`/`balance_usdt` columns with a single `balance` (migrate data as `balance_usdc + balance_usdt`). Same for `lifetime_deposited_*` and `lifetime_withdrawn_*`.
   - `ALTER TABLE campaign_escrow` — same pattern.
   - `ALTER TABLE fee_account` — same pattern.
   - Drop old check constraints; add new `balance_non_negative` / `escrow_balance_non_negative` constraints.
2. Update `schema.prisma` to match.
3. Update all services, workers, DTOs as specified in sections 4–6 above.
4. Update all tests: replace `balance_usdc`/`balance_usdt` seeds and assertions with `balance`.
5. Regenerate OpenAPI spec (`pnpm tsoa spec-and-routes`) and API client.

---

## 9. Files Requiring Changes

| File                                                                         | Change type                                        |
| ---------------------------------------------------------------------------- | -------------------------------------------------- |
| `prisma/schema.prisma`                                                       | Schema — remove 4 columns per table, add `balance` |
| `prisma/migrations/…`                                                        | New migration SQL                                  |
| `packages/common/src/dtos/wallet.dto.ts`                                     | `WalletBalanceDto`, `WithdrawDto`                  |
| `packages/bff/src/services/wallet.service.ts`                                | `getBalance`, `withdraw`                           |
| `packages/bff/src/services/contribution.service.ts`                          | Balance check + debit + escrow credit              |
| `packages/bff/src/services/campaign.service.ts`                              | Payout, refund, fee credit                         |
| `packages/bff/src/workers/deposit-scanner.worker.ts`                         | Balance credit                                     |
| `packages/bff/src/workers/withdrawal.worker.ts`                              | Rollback logic, always USDT mint                   |
| `packages/bff/src/workers/reconciliation.worker.ts`                          | Cross-currency sum check                           |
| `packages/bff/src/workers/consolidation.worker.ts`                           | **New file**                                       |
| `packages/bff/src/controllers/admin.controller.ts`                           | Add `POST /admin/consolidate`                      |
| `packages/bff/src/services/__tests__/contribution.service.test.ts`           | Seed/assert `balance`                              |
| `packages/bff/src/services/__tests__/campaign-state-machine.service.test.ts` | Same                                               |
| `packages/bff/src/services/__tests__/wallet.service.test.ts`                 | Same                                               |
| `packages/bff/src/workers/__tests__/deposit-scanner.worker.test.ts`          | Same                                               |
| `packages/bff/src/workers/__tests__/reconciliation.worker.test.ts`           | Sum assertion                                      |
| `packages/bff/src/workers/__tests__/withdrawal.worker.test.ts`               | Same                                               |
| `packages/fe/src/pages/WalletPage.tsx`                                       | Display single `balance`                           |
