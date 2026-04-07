-- AddColumn: coa_rejection_count to campaign
-- Tracks how many COAs have been manually rejected for a campaign.
-- Monotonic fraud-detection counter; never reset.
ALTER TABLE "campaign" ADD COLUMN "coa_rejection_count" INTEGER NOT NULL DEFAULT 0;
