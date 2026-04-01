-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('campaign_creator', 'contributor', 'lab_approver', 'admin');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('created', 'funded', 'samples_sent', 'results_published', 'resolved', 'refunded');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('usdc', 'usdt');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('user', 'campaign', 'master', 'fee', 'external');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'withdrawal', 'contribution', 'refund', 'payout', 'fee');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('completed', 'pending', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('completed', 'refunded');

-- CreateEnum
CREATE TYPE "ClaimKind" AS ENUM ('mass', 'other');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'code_found', 'code_not_found', 'manually_approved', 'rejected');

-- CreateEnum
CREATE TYPE "UpdateType" AS ENUM ('text', 'state_change');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('thumbs_up', 'rocket', 'praising_hands', 'mad', 'fire');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('campaign_funded', 'campaign_locked', 'samples_shipped', 'coa_uploaded', 'campaign_resolved', 'campaign_refunded', 'deposit_confirmed', 'withdrawal_sent', 'withdrawal_failed');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "username" VARCHAR(50),
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "notification_preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_claim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "claim_type" "ClaimType" NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_user_id" UUID,

    CONSTRAINT "user_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "balance_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "balance_usdt" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lifetime_deposited_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lifetime_deposited_usdt" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lifetime_withdrawn_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lifetime_withdrawn_usdt" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ledger_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_address" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "public_key" VARCHAR(44) NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_deposit_signature" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "signature" VARCHAR(88) NOT NULL,
    "deposit_address_public_key" VARCHAR(44) NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" "Currency" NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_deposit_signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "verification_code" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "amount_requested_usd" DECIMAL(10,2) NOT NULL,
    "funding_threshold_percent" INTEGER NOT NULL,
    "funding_threshold_usd" DECIMAL(10,2) NOT NULL,
    "current_funding_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estimated_lab_cost_usd" DECIMAL(10,2) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'created',
    "is_itemized" BOOLEAN NOT NULL DEFAULT false,
    "itemization_data" JSONB,
    "is_flagged_for_review" BOOLEAN NOT NULL DEFAULT false,
    "flagged_reason" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "platform_fee_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "funded_at" TIMESTAMPTZ,
    "locked_at" TIMESTAMPTZ,
    "samples_sent_at" TIMESTAMPTZ,
    "results_published_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "refunded_at" TIMESTAMPTZ,
    "refund_reason" TEXT,
    "deadline_fundraising" TIMESTAMPTZ NOT NULL,
    "deadline_ship_samples" TIMESTAMPTZ,
    "deadline_publish_results" TIMESTAMPTZ,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_escrow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "balance_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "balance_usdt" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "campaign_escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "balance_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "balance_usdt" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fee_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" "Currency" NOT NULL,
    "from_account_type" "AccountType" NOT NULL,
    "from_account_id" UUID,
    "to_account_type" "AccountType" NOT NULL,
    "to_account_id" UUID,
    "external_address" VARCHAR(44),
    "onchain_signature" VARCHAR(88),
    "reference_id" UUID,
    "status" "TxStatus" NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'completed',
    "contributed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refunded_at" TIMESTAMPTZ,

    CONSTRAINT "contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "vendor_name" VARCHAR(200) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "physical_description" TEXT NOT NULL,
    "sample_label" VARCHAR(200) NOT NULL,
    "target_lab_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_claim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sample_id" UUID NOT NULL,
    "claim_type" "ClaimKind" NOT NULL,
    "mass_amount" DECIMAL(10,4),
    "mass_unit" VARCHAR(20),
    "other_description" TEXT,

    CONSTRAINT "sample_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sample_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,

    CONSTRAINT "test_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sample_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "s3_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ocr_text" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verified_by_user_id" UUID,
    "verified_at" TIMESTAMPTZ,
    "verification_notes" TEXT,

    CONSTRAINT "coa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "phone_number" VARCHAR(50),
    "country" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "usp_code" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lab_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "typical_turnaround_days" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lab_test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_price_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lab_test_id" UUID NOT NULL,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "effective_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ,
    "changed_by_user_id" UUID NOT NULL,
    "change_reason" TEXT,

    CONSTRAINT "lab_test_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_update" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "update_type" "UpdateType" NOT NULL,
    "state_change_from" VARCHAR(50),
    "state_change_to" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_update_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reaction_type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "campaign_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_email" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_user_id" UUID,

    CONSTRAINT "configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_username_idx" ON "user"("username");

-- CreateIndex
CREATE INDEX "user_claim_user_id_idx" ON "user_claim"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_claim_user_id_claim_type_key" ON "user_claim"("user_id", "claim_type");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "refresh_token_expires_at_idx" ON "refresh_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_account_user_id_key" ON "ledger_account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_address_user_id_key" ON "deposit_address"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_address_public_key_key" ON "deposit_address"("public_key");

-- CreateIndex
CREATE UNIQUE INDEX "processed_deposit_signature_signature_key" ON "processed_deposit_signature"("signature");

-- CreateIndex
CREATE INDEX "processed_deposit_signature_deposit_address_public_key_idx" ON "processed_deposit_signature"("deposit_address_public_key");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_verification_code_key" ON "campaign"("verification_code");

-- CreateIndex
CREATE INDEX "campaign_creator_id_idx" ON "campaign"("creator_id");

-- CreateIndex
CREATE INDEX "campaign_status_idx" ON "campaign"("status");

-- CreateIndex
CREATE INDEX "campaign_verification_code_idx" ON "campaign"("verification_code");

-- CreateIndex
CREATE INDEX "campaign_created_at_idx" ON "campaign"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_escrow_campaign_id_key" ON "campaign_escrow"("campaign_id");

-- CreateIndex
CREATE INDEX "ledger_transaction_from_account_type_from_account_id_idx" ON "ledger_transaction"("from_account_type", "from_account_id");

-- CreateIndex
CREATE INDEX "ledger_transaction_to_account_type_to_account_id_idx" ON "ledger_transaction"("to_account_type", "to_account_id");

-- CreateIndex
CREATE INDEX "ledger_transaction_onchain_signature_idx" ON "ledger_transaction"("onchain_signature");

-- CreateIndex
CREATE INDEX "ledger_transaction_transaction_type_idx" ON "ledger_transaction"("transaction_type");

-- CreateIndex
CREATE INDEX "ledger_transaction_status_idx" ON "ledger_transaction"("status");

-- CreateIndex
CREATE INDEX "ledger_transaction_reference_id_idx" ON "ledger_transaction"("reference_id");

-- CreateIndex
CREATE INDEX "ledger_transaction_created_at_idx" ON "ledger_transaction"("created_at");

-- CreateIndex
CREATE INDEX "contribution_campaign_id_idx" ON "contribution"("campaign_id");

-- CreateIndex
CREATE INDEX "contribution_contributor_id_idx" ON "contribution"("contributor_id");

-- CreateIndex
CREATE INDEX "contribution_status_idx" ON "contribution"("status");

-- CreateIndex
CREATE INDEX "sample_campaign_id_idx" ON "sample"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_request_sample_id_test_id_key" ON "test_request"("sample_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "coa_sample_id_key" ON "coa"("sample_id");

-- CreateIndex
CREATE INDEX "coa_campaign_id_idx" ON "coa"("campaign_id");

-- CreateIndex
CREATE INDEX "coa_verification_status_idx" ON "coa"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "lab_name_key" ON "lab"("name");

-- CreateIndex
CREATE INDEX "lab_is_approved_idx" ON "lab"("is_approved");

-- CreateIndex
CREATE UNIQUE INDEX "test_name_key" ON "test"("name");

-- CreateIndex
CREATE INDEX "test_is_active_idx" ON "test"("is_active");

-- CreateIndex
CREATE INDEX "lab_test_lab_id_idx" ON "lab_test"("lab_id");

-- CreateIndex
CREATE INDEX "lab_test_test_id_idx" ON "lab_test"("test_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_lab_id_test_id_key" ON "lab_test"("lab_id", "test_id");

-- CreateIndex
CREATE INDEX "lab_test_price_history_lab_test_id_effective_from_idx" ON "lab_test_price_history"("lab_test_id", "effective_from");

-- CreateIndex
CREATE INDEX "campaign_update_campaign_id_created_at_idx" ON "campaign_update"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "reaction_campaign_id_idx" ON "reaction"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_campaign_id_user_id_reaction_type_key" ON "reaction"("campaign_id", "user_id", "reaction_type");

-- CreateIndex
CREATE INDEX "notification_user_id_is_read_idx" ON "notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notification_user_id_created_at_idx" ON "notification"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_config_key_key" ON "configuration"("config_key");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_token_token_hash_key" ON "email_verification_token"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_token_user_id_idx" ON "email_verification_token"("user_id");
