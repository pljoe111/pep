-- Option B: Single Unified Balance migration.
-- Merges balance_usdc + balance_usdt into a single `balance` field on
-- ledger_account, campaign_escrow, and fee_account.
-- Currency is preserved on ledger_transaction, processed_deposit_signature,
-- and contribution for historical audit purposes.

-- ── ledger_account ────────────────────────────────────────────────────────────

-- Drop old check constraints
ALTER TABLE "ledger_account" DROP CONSTRAINT IF EXISTS "balance_usdc_non_negative";
ALTER TABLE "ledger_account" DROP CONSTRAINT IF EXISTS "balance_usdt_non_negative";

-- Add new unified columns with safe defaults
ALTER TABLE "ledger_account"
  ADD COLUMN IF NOT EXISTS "balance"            DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_deposited" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_withdrawn" DECIMAL(18,6) NOT NULL DEFAULT 0;

-- Migrate data: sum old per-currency columns into the new unified column
UPDATE "ledger_account"
SET
  "balance"            = COALESCE("balance_usdc", 0) + COALESCE("balance_usdt", 0),
  "lifetime_deposited" = COALESCE("lifetime_deposited_usdc", 0) + COALESCE("lifetime_deposited_usdt", 0),
  "lifetime_withdrawn" = COALESCE("lifetime_withdrawn_usdc", 0) + COALESCE("lifetime_withdrawn_usdt", 0);

-- Drop old per-currency columns
ALTER TABLE "ledger_account"
  DROP COLUMN IF EXISTS "balance_usdc",
  DROP COLUMN IF EXISTS "balance_usdt",
  DROP COLUMN IF EXISTS "lifetime_deposited_usdc",
  DROP COLUMN IF EXISTS "lifetime_deposited_usdt",
  DROP COLUMN IF EXISTS "lifetime_withdrawn_usdc",
  DROP COLUMN IF EXISTS "lifetime_withdrawn_usdt";

-- Add new non-negative check constraint
ALTER TABLE "ledger_account"
  ADD CONSTRAINT "ledger_account_balance_non_negative" CHECK ("balance" >= 0);

-- ── campaign_escrow ───────────────────────────────────────────────────────────

ALTER TABLE "campaign_escrow" DROP CONSTRAINT IF EXISTS "escrow_usdc_non_negative";
ALTER TABLE "campaign_escrow" DROP CONSTRAINT IF EXISTS "escrow_usdt_non_negative";

ALTER TABLE "campaign_escrow"
  ADD COLUMN IF NOT EXISTS "balance" DECIMAL(18,6) NOT NULL DEFAULT 0;

UPDATE "campaign_escrow"
SET "balance" = COALESCE("balance_usdc", 0) + COALESCE("balance_usdt", 0);

ALTER TABLE "campaign_escrow"
  DROP COLUMN IF EXISTS "balance_usdc",
  DROP COLUMN IF EXISTS "balance_usdt";

ALTER TABLE "campaign_escrow"
  ADD CONSTRAINT "campaign_escrow_balance_non_negative" CHECK ("balance" >= 0);

-- ── fee_account ────────────────────────────────────────────────────────────────

ALTER TABLE "fee_account"
  ADD COLUMN IF NOT EXISTS "balance" DECIMAL(18,6) NOT NULL DEFAULT 0;

UPDATE "fee_account"
SET "balance" = COALESCE("balance_usdc", 0) + COALESCE("balance_usdt", 0);

ALTER TABLE "fee_account"
  DROP COLUMN IF EXISTS "balance_usdc",
  DROP COLUMN IF EXISTS "balance_usdt";
