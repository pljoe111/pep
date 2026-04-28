# Implementation Plan: PyUSD + Settlement Normalization at Ingress

**Status:** Ready for implementation  
**Decisions locked:**

- Accept USDC, USDT, and PyUSD on-chain
- Instantly convert all non-USDT deposits to USDT via Jupiter v6 (never hold USDC/PyUSD)
- Charge a fixed **50 bps (0.5%) conversion fee** on all non-USDT deposits — platform keeps the spread
- USDT deposits: zero conversion fee, credited 1:1
- Withdrawals: unchanged — always sent as USDT on-chain

---

## Why instant swap + fixed fee

**PyUSD risk:** Token-2022 permanent delegate — PayPal can move tokens from any account
without the account owner's signature. Never hold PyUSD overnight.

**USDC risk:** Circle freeze authority (cannot seize without a key, but can freeze). Low risk,
but keeping USDC on the master wallet is inconsistent with the "USDT-only" settlement model.

**Fixed fee instead of variable slippage:**  
Pre-deposit quotes go stale (30-second async deposit window). Variable slippage credited post-swap
feels like missing funds to the user. A fixed transparent fee is honest, predictable, and
fits the existing platform fee architecture (`fee_account` + `LedgerTransaction` type `fee`).

```
Example: $100 USDC deposit
  Jupiter actual swap cost:  ~5 bps ($0.05)    ← DEX takes this
  Conversion fee charged:    50 bps ($0.50)    ← platform revenue
  User receives:             $99.50 USDT        ← exact, predictable
  Platform earns:            ~$0.45 on this deposit
```

The fee rate is stored in the `Configuration` table (`deposit_conversion_fee_bps`) — adjustable
by admin without a code deploy.

---

## Architecture

```
For all incoming deposits:

  USDT:
    sweep to master → credit 100% of USDT amount to ledger
                      LedgerTransaction type=deposit, currency=usdt

  USDC / PyUSD:
    sweep to master → swapToUsdt() via Jupiter → apply 50 bps fee →
    credit netCredit to user ledger account
    credit feeRaw to fee_account
    LedgerTransaction type=deposit, currency=(original), amount=netCredit
    LedgerTransaction type=fee,     currency=usdt,       amount=feeRaw
```

---

## Files that change — complete map

### A. Infrastructure / Config

---

#### `packages/bff/prisma/schema.prisma`

**Change 1 — add `pyusd` to `Currency` enum:**

```prisma
enum Currency {
  usdc
  usdt
  pyusd // ← add
}
```

**Change 2 — add `pyusd_balance` column to `MasterWallet`:**

```prisma
model MasterWallet {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  usdc_balance  Decimal  @default(0) @db.Decimal(18, 6)
  usdt_balance  Decimal  @default(0) @db.Decimal(18, 6)
  pyusd_balance Decimal  @default(0) @db.Decimal(18, 6) // ← add
  updated_at    DateTime @updatedAt @db.Timestamptz

  @@map("master_wallet")
}
```

---

#### New Prisma migration

**File:** `packages/bff/prisma/migrations/20260412000000_add_pyusd/migration.sql`

```sql
-- Add pyusd to Currency enum (non-blocking in PostgreSQL — no table rewrite)
ALTER TYPE "Currency" ADD VALUE 'pyusd';

-- Add pyusd on-chain balance snapshot column to master_wallet read-cache
ALTER TABLE "master_wallet" ADD COLUMN "pyusd_balance" DECIMAL(18,6) NOT NULL DEFAULT 0;
```

---

#### `packages/bff/prisma/seed.ts`

Add `deposit_conversion_fee_bps` to the Configuration seed block:

```ts
{
  config_key:   'deposit_conversion_fee_bps',
  config_value: 50,
  description:  'Basis points charged on USDC/PyUSD deposits for currency conversion. 50 = 0.5%. Adjustable without code deploy.',
},
```

---

#### `packages/bff/src/config/env.config.ts`

Add under the Solana section:

```ts
PYUSD_MINT: str(),
// mainnet: 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
// devnet:  CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM
```

Keep existing consolidation thresholds (safety-net only now):

```ts
CONSOLIDATION_THRESHOLD_USDC:  num({ default: 100 }),  // existing — keep
CONSOLIDATION_THRESHOLD_PYUSD: num({ default: 100 }),  // ← add (safety net)
```

---

#### `packages/bff/.env.example`

```
# PyUSD (Solana Token-2022)
PYUSD_MINT=2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo

# Safety-net consolidation thresholds (residual balance, display units)
CONSOLIDATION_THRESHOLD_USDC=100
CONSOLIDATION_THRESHOLD_PYUSD=100
```

---

#### `packages/bff/src/services/configuration.service.ts`

Add type for the new config key:

```ts
export interface DepositConversionFeeBpsConfig {
  value: number; // basis points, e.g. 50 = 0.50%
}
```

---

### B. Core Solana Layer

---

#### `packages/bff/src/services/solana.service.ts` ⚠️ Most complex change

**New import:**

```ts
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID, // ← add
  getAssociatedTokenAddress,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
```

**New internal types (not exported):**

```ts
export type SupportedCurrency = 'usdc' | 'usdt' | 'pyusd';

interface MintConfig {
  pubkey: PublicKey;
  decimals: number;
  programId: PublicKey; // TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID
}
```

**Constructor — replace hard-coded `usdcMint`/`usdtMint` with a config map:**

```ts
// REMOVE: private readonly usdcMint: PublicKey;
// REMOVE: private readonly usdtMint: PublicKey;

// ADD:
private readonly mintConfigs: Record<SupportedCurrency, MintConfig>;

// In constructor body:
this.mintConfigs = {
  usdc:  { pubkey: new PublicKey(env.USDC_MINT),  decimals: 6, programId: TOKEN_PROGRAM_ID       },
  usdt:  { pubkey: new PublicKey(env.USDT_MINT),  decimals: 6, programId: TOKEN_PROGRAM_ID       },
  pyusd: { pubkey: new PublicKey(env.PYUSD_MINT), decimals: 6, programId: TOKEN_2022_PROGRAM_ID  },
};
```

**`sweepDeposit` — widen signature, thread `programId`:**

```ts
async sweepDeposit(
  encryptedPrivateKey: string,
  amount: bigint,
  mint: SupportedCurrency   // was: 'usdc' | 'usdt'
): Promise<string> {
  const { pubkey: mintPubkey, programId } = this.mintConfigs[mint];

  const sourceATA = await getOrCreateAssociatedTokenAccount(
    this.connection, this.masterKeypair, mintPubkey, depositKeypair.publicKey,
    false, 'confirmed', undefined, programId   // ← programId
  );
  const destATA = await getOrCreateAssociatedTokenAccount(
    this.connection, this.masterKeypair, mintPubkey, this.masterKeypair.publicKey,
    false, 'confirmed', undefined, programId
  );
  const transferIx = createTransferInstruction(
    sourceATA.address, destATA.address, depositKeypair.publicKey, amount,
    [], programId   // ← programId
  );
  // ... rest unchanged
}
```

**`executeWithdrawal` — same `programId` threading:**

```ts
async executeWithdrawal(
  destinationAddress: string,
  amount: bigint,
  mint: SupportedCurrency   // was: 'usdc' | 'usdt'
): Promise<string> {
  const { pubkey: mintPubkey, programId } = this.mintConfigs[mint];

  const sourceATA = await getAssociatedTokenAddress(
    mintPubkey, this.masterKeypair.publicKey, false, programId
  );
  const destATA = await getOrCreateAssociatedTokenAccount(
    this.connection, this.masterKeypair, mintPubkey, destPubkey,
    false, 'confirmed', undefined, programId
  );
  const transferIx = createTransferInstruction(
    sourceATA, destATA.address, this.masterKeypair.publicKey, amount,
    [], programId
  );
  // ... rest unchanged
}
```

**`getTokenBalance` — widen signature, use `mintConfigs` decimals:**

```ts
async getTokenBalance(ownerAddress: string, mint: SupportedCurrency): Promise<number> {
  const { pubkey: mintPubkey, decimals } = this.mintConfigs[mint];
  // Remove the manual decimals ternary — use decimals from mintConfigs
}
```

**REPLACE `swapUsdcToUsdt` with generalized `swapToUsdt`:**

```ts
/**
 * Swap any supported non-USDT currency → USDT via Jupiter v6.
 * Returns usdtReceived (actual raw USDT from quoteData.outAmount) and signature.
 *
 * Slippage tolerance:
 *   usdc  →  50 bps (0.5%) — deep pool
 *   pyusd → 100 bps (1.0%) — thinner pool; PayPal clawback risk
 *
 * The caller applies the platform conversion fee on top of usdtReceived.
 * This method does not touch the ledger — pure on-chain operation.
 */
async swapToUsdt(
  amountRaw: bigint,
  fromCurrency: Exclude<SupportedCurrency, 'usdt'>
): Promise<{ usdtReceived: bigint; signature: string }> {
  const { pubkey: inputMint } = this.mintConfigs[fromCurrency];
  const slippageBps = fromCurrency === 'pyusd' ? '100' : '50';

  const quoteParams = new URLSearchParams({
    inputMint:   inputMint.toBase58(),
    outputMint:  env.USDT_MINT,
    amount:      amountRaw.toString(),
    slippageBps,
  });

  const quoteRes = await fetch(`https://quote-api.jup.ag/v6/quote?${quoteParams.toString()}`);
  if (!quoteRes.ok) {
    throw new Error(`Jupiter quote failed: ${quoteRes.status} ${quoteRes.statusText}`);
  }

  const quoteData = (await quoteRes.json()) as { outAmount: string; [key: string]: unknown };
  const usdtReceived = BigInt(quoteData.outAmount); // actual USDT raw units after swap

  const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      quoteResponse:    quoteData,
      userPublicKey:    this.masterKeypair.publicKey.toBase58(),
      wrapAndUnwrapSol: false,
    }),
  });
  if (!swapRes.ok) {
    throw new Error(`Jupiter swap failed: ${swapRes.status} ${swapRes.statusText}`);
  }

  const swapData  = (await swapRes.json()) as { swapTransaction: string };
  const txBuf     = Buffer.from(swapData.swapTransaction, 'base64');
  const tx        = VersionedTransaction.deserialize(txBuf);
  tx.sign([this.masterKeypair]);

  const signature = await this.connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await this.connection.confirmTransaction(signature, 'confirmed');

  logger.info(
    { fromCurrency, amountRaw: amountRaw.toString(), usdtReceived: usdtReceived.toString(), signature },
    'Deposit swap to USDT confirmed'
  );
  return { usdtReceived, signature };
}
```

> **`swapUsdcToUsdt` is deleted.** `ConsolidationService` updated to call `swapToUsdt`.

---

### C. Workers

---

#### `packages/bff/src/workers/deposit-scanner.worker.ts` ⚠️ Key business logic change

**Type and mint map:**

```ts
type SupportedCurrency = 'usdc' | 'usdt' | 'pyusd';

const CURRENCY_MINTS: Record<SupportedCurrency, string> = {
  usdc:  env.USDC_MINT,
  usdt:  env.USDT_MINT,
  pyusd: env.PYUSD_MINT,
};

// Loop: was ['usdc', 'usdt'], becomes:
for (const currency of ['usdc', 'usdt', 'pyusd'] as const) { ... }
```

**After sweep succeeds — add conversion + fee block:**

```ts
// ─── Settlement normalization ─────────────────────────────────────────────────
// USDT: credit as-is. USDC/PyUSD: swap to USDT → apply conversion fee.

let creditAmountRaw: bigint; // USDT raw units to credit to user
let swapSignature: string | null = null;
let feeAmountRaw: bigint = 0n; // USDT raw units to credit to fee_account

if (currency !== 'usdt') {
  // Instant swap — master wallet must not hold non-USDT tokens
  // PyUSD: permanent delegate risk → block credit entirely on failure
  // USDC:  freeze risk only → credit raw USDC as fallback, consolidation cleans up
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
    logger.error({ error: msg, address: depAddr.public_key, currency }, 'Deposit swap failed');

    if (currency === 'pyusd') {
      // HIGH RISK: PayPal permanent delegate. Do NOT credit. Retry next cycle.
      // The processedDepositSignature guard ensures no double-sweep.
      continue;
    }
    // USDC fallback: credit raw USDC; ConsolidationService safety net cleans up.
    creditAmountRaw = rawBalance;
    feeAmountRaw = 0n;
    swapSignature = null;
    logger.warn(
      { address: depAddr.public_key },
      'USDC swap failed — crediting raw USDC as fallback'
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
```

**Helper function (add above the worker registration):**

```ts
async function getConversionFeeBps(prisma: PrismaService): Promise<number> {
  const row = await prisma.configuration.findUnique({
    where: { config_key: 'deposit_conversion_fee_bps' },
  });
  if (row === null) return 50; // safe default
  const val = row.config_value;
  return typeof val === 'number' ? val : 50;
}
```

**DB transaction — credit user + fee (inside the existing `prisma.$transaction` block):**

```ts
await prisma.$transaction(
  async (tx) => {
    // Idempotency guard (unchanged)
    try {
      await tx.processedDepositSignature.create({
        data: {
          signature: sweepSignature,
          deposit_address_public_key: depAddr.public_key,
          amount,
          currency,
        },
      });
    } catch {
      return; // already processed
    }

    // Credit user unified balance
    await tx.ledgerAccount.update({
      where: { user_id: depAddr.user_id },
      data: {
        balance: { increment: amount },
        lifetime_deposited: { increment: amount },
      },
    });

    // Deposit ledger record — original currency for audit, USDT-equivalent amount
    await tx.ledgerTransaction.create({
      data: {
        transaction_type: 'deposit',
        status: 'completed',
        amount, // USDT-equivalent net credit
        currency, // original deposited currency (audit)
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
        ? `${depositDisplay} ${currencyLabel} deposited and converted to ${creditDisplay} USDT (0.5% conversion fee applied).`
        : `${creditDisplay} USDT has been credited to your balance.`;

    await notif.send(depAddr.user_id, 'deposit_confirmed', 'system', 'Deposit Received', message);
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
);
```

---

#### `packages/bff/src/workers/consolidation.worker.ts`

This worker is now a **safety net only** (runs on admin trigger for residual balances).
Replace `swapUsdcToUsdt` call with `swapToUsdt`:

```ts
// USDC safety-net sweep
const usdcRaw = await this.solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'usdc');
if (usdcRaw / 1_000_000 >= env.CONSOLIDATION_THRESHOLD_USDC) {
  const { signature } = await this.solana.swapToUsdt(BigInt(usdcRaw), 'usdc');
  // ... log/respond
}

// PyUSD safety-net sweep (new)
const pyusdRaw = await this.solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'pyusd');
if (pyusdRaw / 1_000_000 >= env.CONSOLIDATION_THRESHOLD_PYUSD) {
  const { signature } = await this.solana.swapToUsdt(BigInt(pyusdRaw), 'pyusd');
  // ... log/respond
}
```

> Note: ConsolidationService does NOT apply the conversion fee — it is a platform
> maintenance operation, not a user deposit. No user `from_account_id` → no fee record.

Update `ConsolidationResponseDto` (in `packages/common/src/dtos/admin.dto.ts`) to include:

```ts
pyusd_triggered: boolean;
pyusd_message: string;
```

---

#### `packages/bff/src/workers/reconciliation.worker.ts`

Add pyusd to on-chain balance fetch and MasterWallet snapshot:

```ts
const [usdcOnchain, usdtOnchain, pyusdOnchain] = await Promise.all([
  solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'usdc'),
  solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'usdt'),
  solana.getTokenBalance(env.MASTER_WALLET_PUBLIC_KEY, 'pyusd'), // ← add
]);
const onchainTotal = (usdcOnchain + usdtOnchain + pyusdOnchain) / 1_000_000;

// MasterWallet snapshot:
await prisma.masterWallet.update({
  where: { id: masterWallet.id },
  data: {
    usdc_balance: usdcDisplay,
    usdt_balance: usdtDisplay,
    pyusd_balance: pyusdDisplay, // ← add
  },
});
```

---

#### `packages/bff/src/workers/withdrawal.worker.ts`

**No changes.** Withdrawals continue as USDT only. Unchanged.

---

### D. Common DTOs

---

#### `packages/common/src/dtos/wallet.dto.ts`

```ts
// Line 5
export type Currency = 'usdc' | 'usdt' | 'pyusd';
```

---

#### `packages/common/src/dtos/contribution.dto.ts`

```ts
@IsEnum(['usdc', 'usdt', 'pyusd'] as const)
currency!: Currency;
```

---

#### `packages/common/src/dtos/app-info.dto.ts`

```ts
export interface AppInfoDto {
  version: string;
  network: string;
  usdc_mint: string;
  usdt_mint: string;
  pyusd_mint: string; // ← add
  deposit_conversion_fee_bps: number; // ← add — FE shows "0.5% conversion fee"
  minimums: GlobalMinimumsConfig;
  platform_fee_percent: number;
  max_campaign_multiplier: number;
}
```

---

### E. BFF Controller

---

#### `packages/bff/src/controllers/app-info.controller.ts`

Add to response:

```ts
pyusd_mint:                 env.PYUSD_MINT,
deposit_conversion_fee_bps: await this.configService.get<{ value: number }>('deposit_conversion_fee_bps').then(c => c.value),
```

---

### F. API Client

After all DTO changes are committed and `pnpm --filter bff build` passes with zero errors:

```bash
pnpm --filter api-client generate
```

---

### G. Frontend

---

#### `packages/fe/src/api/hooks/useAppInfo.ts`

No code change — automatically picks up `pyusd_mint` and `deposit_conversion_fee_bps` from regenerated client.

---

#### `packages/fe/src/pages/campaign-detail/sheets/ContributeSheet.tsx`

Add PyUSD to currency selector:

```tsx
const CURRENCY_OPTIONS = [
  { value: 'usdc', label: 'USDC', description: 'USD Coin' },
  { value: 'usdt', label: 'USDT', description: 'Tether USD' },
  { value: 'pyusd', label: 'PYUSD', description: 'PayPal USD' },
] as const;
```

---

#### `packages/fe/src/pages/wallet/components/DepositSheet.tsx` (or equivalent)

Update accepted currencies copy and add conversion fee disclosure:

```tsx
// Show conversion fee note when USDC or PyUSD is selected
// Source fee rate from useAppInfo().data.deposit_conversion_fee_bps

const feePercent = (appInfo.deposit_conversion_fee_bps / 100).toFixed(1); // "0.5"

// Chip / info row below deposit address:
// "USDC and PYUSD deposits are converted to USDT on receipt.
//  A {feePercent}% conversion fee applies. USDT deposits: no fee."
```

---

#### `packages/fe/src/lib/badgeUtils.ts` (or transaction currency display)

Add `'pyusd'` wherever `currency` is mapped to a display string:

```ts
case 'pyusd': return 'PYUSD';
```

---

### H. Tests

| File                                                        | What to add/change                                                                                                                                                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `services/__tests__/solana.service.test.ts` (new)           | `swapToUsdt('usdc')` and `swapToUsdt('pyusd')` — mock `fetch`, assert `usdtReceived` equals `quoteData.outAmount`; assert `TOKEN_2022_PROGRAM_ID` passed for pyusd ATA derivation                                                          |
| `workers/__tests__/deposit-scanner.worker.test.ts` (extend) | USDC deposit: swap called, fee deducted, user gets netCredit, fee_account incremented; PyUSD deposit: same; PyUSD swap failure: nothing credited; USDC swap failure: raw USDC credited, no fee; USDT deposit: no swap, no fee, full credit |
| `services/__tests__/contribution.service.test.ts` (extend)  | `ContributeDto` with `currency: 'pyusd'` passes validation                                                                                                                                                                                 |
| `workers/__tests__/reconciliation.worker.test.ts` (extend)  | 3-currency on-chain sum (usdc + usdt + pyusd) compared to internal; pyusd_balance updated on MasterWallet snapshot                                                                                                                         |
| `services/__tests__/wallet.service.test.ts`                 | No changes needed — withdrawal path unchanged                                                                                                                                                                                              |

---

## Execution order

| #   | Step                                                                                   | Gate                                               |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | DB migration (`ALTER TYPE`, `ALTER TABLE`)                                             | Must run before BFF starts                         |
| 2   | `env.config.ts` + `.env.example`                                                       | `SolanaService` fails startup without `PYUSD_MINT` |
| 3   | `configuration.service.ts` — add `DepositConversionFeeBpsConfig` type                  |                                                    |
| 4   | `schema.prisma` seed — add `deposit_conversion_fee_bps`                                |                                                    |
| 5   | `solana.service.ts` — `mintConfigs`, Token-2022, `swapToUsdt`, delete `swapUsdcToUsdt` |                                                    |
| 6   | `deposit-scanner.worker.ts` — add pyusd, instant-swap, conversion fee                  |                                                    |
| 7   | `consolidation.worker.ts` — call `swapToUsdt`, add pyusd pass                          |                                                    |
| 8   | `reconciliation.worker.ts` — add pyusd balance, update MasterWallet snapshot           |                                                    |
| 9   | `common/dtos/wallet.dto.ts` — `Currency` type                                          |                                                    |
| 10  | `common/dtos/contribution.dto.ts` — `@IsEnum`                                          |                                                    |
| 11  | `common/dtos/app-info.dto.ts` — `pyusd_mint`, `deposit_conversion_fee_bps`             |                                                    |
| 12  | `common/dtos/admin.dto.ts` — `ConsolidationResponseDto` pyusd fields                   |                                                    |
| 13  | `app-info.controller.ts` — expose new fields                                           |                                                    |
| 14  | `pnpm --filter bff build` — must pass zero errors                                      | Gate for API client                                |
| 15  | `pnpm --filter bff lint` — must pass zero warnings                                     | Gate for API client                                |
| 16  | `pnpm --filter api-client generate`                                                    |                                                    |
| 17  | FE: `ContributeSheet`, `DepositSheet`, `badgeUtils`                                    |                                                    |
| 18  | All tests written and passing                                                          |                                                    |

---

## What is deliberately NOT changing

| Item                                              | Reason                                    |
| ------------------------------------------------- | ----------------------------------------- |
| `LedgerAccount.balance` (single unified field)    | Option B — unchanged                      |
| `CampaignEscrow.balance`                          | Same                                      |
| Withdrawal always sends USDT                      | Spec rule — unchanged                     |
| `SERIALIZABLE` isolation on all balance mutations | Unchanged                                 |
| Error class set (8 classes)                       | No new error types needed                 |
| SOL fee payer for sweeps/swaps                    | Master wallet pays SOL fees — unchanged   |
| `ProcessedDepositSignature` idempotency           | Sweep signature as unique key — unchanged |
| `FeeAccount` model                                | Reused as-is for conversion fee revenue   |

---

## Fee revenue estimate

At 50 bps conversion fee:

| Monthly non-USDT deposit volume | Monthly platform revenue |
| ------------------------------- | ------------------------ |
| $10,000                         | $50                      |
| $50,000                         | $250                     |
| $200,000                        | $1,000                   |

Jupiter actual cost is typically 5–30 bps, so platform net margin on the conversion is ~20–45 bps.
Rate is adjustable in `Configuration` table via admin panel — no deploy needed.
