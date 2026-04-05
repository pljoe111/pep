-- Migration: Campaign Creator Redesign
-- Adds: Peptide, Vendor, TestClaimTemplate models
-- Extends: ClaimKind enum, NotificationType enum, Sample, SampleClaim, Test, LabTest

-- ─── New enum types ───────────────────────────────────────────────────────────

CREATE TYPE "VendorStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "EndotoxinMode" AS ENUM ('exact_value', 'pass_fail');

-- Extend ClaimKind enum with new values
ALTER TYPE "ClaimKind" ADD VALUE IF NOT EXISTS 'purity';
ALTER TYPE "ClaimKind" ADD VALUE IF NOT EXISTS 'identity';
ALTER TYPE "ClaimKind" ADD VALUE IF NOT EXISTS 'endotoxins';
ALTER TYPE "ClaimKind" ADD VALUE IF NOT EXISTS 'sterility';

-- Extend NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'peptide_approved';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'peptide_rejected';

-- ─── New tables ───────────────────────────────────────────────────────────────

CREATE TABLE "peptide" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(200) NOT NULL,
    "aliases"     TEXT[]      NOT NULL DEFAULT '{}',
    "description" TEXT,
    "is_active"   BOOLEAN     NOT NULL DEFAULT false,
    "created_by"  UUID        NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "peptide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "peptide_name_key" ON "peptide"("name");
CREATE INDEX "peptide_name_idx" ON "peptide"("name");

CREATE TABLE "vendor" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "name"           VARCHAR(200)  NOT NULL,
    "website"        VARCHAR(500),
    "country"        VARCHAR(100),
    "telegram_group" VARCHAR(200),
    "contact_notes"  TEXT,
    "status"         "VendorStatus" NOT NULL DEFAULT 'pending',
    "submitted_by"   UUID          NOT NULL,
    "reviewed_by"    UUID,
    "reviewed_at"    TIMESTAMPTZ,
    "review_notes"   TEXT,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_name_key" ON "vendor"("name");
CREATE INDEX "vendor_status_idx" ON "vendor"("status");
CREATE INDEX "vendor_name_idx" ON "vendor"("name");

CREATE TABLE "test_claim_template" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "test_id"     UUID         NOT NULL,
    "claim_kind"  "ClaimKind"  NOT NULL,
    "label"       VARCHAR(200) NOT NULL,
    "is_required" BOOLEAN      NOT NULL DEFAULT false,
    "sort_order"  INTEGER      NOT NULL DEFAULT 0,

    CONSTRAINT "test_claim_template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "test_claim_template_test_id_claim_kind_key" ON "test_claim_template"("test_id", "claim_kind");

ALTER TABLE "test_claim_template"
    ADD CONSTRAINT "test_claim_template_test_id_fkey"
    FOREIGN KEY ("test_id") REFERENCES "test"("id") ON DELETE CASCADE;

-- ─── Extend existing tables ───────────────────────────────────────────────────

-- Sample: add peptide_id and vendor_id FKs
ALTER TABLE "sample"
    ADD COLUMN "peptide_id" UUID,
    ADD COLUMN "vendor_id"  UUID;

CREATE INDEX "sample_peptide_id_idx" ON "sample"("peptide_id");
CREATE INDEX "sample_vendor_id_idx"  ON "sample"("vendor_id");

ALTER TABLE "sample"
    ADD CONSTRAINT "sample_peptide_id_fkey"
    FOREIGN KEY ("peptide_id") REFERENCES "peptide"("id") ON DELETE SET NULL;

ALTER TABLE "sample"
    ADD CONSTRAINT "sample_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL;

-- SampleClaim: add new claim-type-specific fields
ALTER TABLE "sample_claim"
    ADD COLUMN "purity_percent"      DECIMAL(6,3),
    ADD COLUMN "endotoxin_value"     DECIMAL(10,4),
    ADD COLUMN "endotoxin_pass"      BOOLEAN,
    ADD COLUMN "sterility_pass"      BOOLEAN,
    ADD COLUMN "identity_peptide_id" UUID,
    ADD COLUMN "is_required"         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "sort_order"          INTEGER NOT NULL DEFAULT 0;

-- Test: add vials_required
ALTER TABLE "test"
    ADD COLUMN "vials_required" INTEGER NOT NULL DEFAULT 1;

-- LabTest: add vials_required and endotoxin_mode
ALTER TABLE "lab_test"
    ADD COLUMN "vials_required" INTEGER        NOT NULL DEFAULT 1,
    ADD COLUMN "endotoxin_mode" "EndotoxinMode" NOT NULL DEFAULT 'pass_fail';

-- Notification: make campaign_id nullable to support non-campaign notifications
ALTER TABLE "notification"
    ALTER COLUMN "campaign_id" DROP NOT NULL;
