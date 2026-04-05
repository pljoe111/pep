-- Migration: Add master_wallet singleton table
-- One row only. Seeded in seed.ts. Written by ReconciliationWorker after each hourly pass.
-- Not part of the ledger balance formula — purely a snapshot/cache of on-chain state.

CREATE TABLE "master_wallet" (
    "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
    "usdc_balance" NUMERIC(18,6) NOT NULL DEFAULT 0,
    "usdt_balance" NUMERIC(18,6) NOT NULL DEFAULT 0,
    "updated_at"   TIMESTAMPTZ   NOT NULL,

    CONSTRAINT "master_wallet_pkey" PRIMARY KEY ("id")
);
