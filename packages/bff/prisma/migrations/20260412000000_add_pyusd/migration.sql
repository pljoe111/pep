-- Add pyusd to Currency enum (non-blocking in PostgreSQL — no table rewrite)
ALTER TYPE "Currency" ADD VALUE 'pyusd';

-- Add pyusd on-chain balance snapshot column to master_wallet read-cache
ALTER TABLE "master_wallet" ADD COLUMN "pyusd_balance" DECIMAL(18,6) NOT NULL DEFAULT 0;
