-- Move rejection counter from campaign to coa (per-sample tracking is more precise for fraud detection).
-- Uses IF NOT EXISTS / IF EXISTS to be safe if columns already exist from a prior partial apply.
ALTER TABLE "coa" ADD COLUMN IF NOT EXISTS "rejection_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaign" DROP COLUMN IF EXISTS "coa_rejection_count";
