import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { ClaimType } from './user.dto';
import type { Currency } from './wallet.dto';
import type { VerificationStatus } from './campaign.dto';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class AdminRefundDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class AdminHideCampaignDto {
  @IsBoolean()
  hidden!: boolean;
}

export class AdminFlagCampaignDto {
  @IsBoolean()
  flagged!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminBanUserDto {
  @IsBoolean()
  banned!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminClaimDto {
  @IsEnum(['campaign_creator', 'contributor', 'user_submitted_data_approver', 'admin'] as const)
  claim_type!: ClaimType;

  @IsEnum(['grant', 'revoke'] as const)
  action!: 'grant' | 'revoke';
}

export class AdminVerifyCoaDto {
  @IsEnum(['approved', 'rejected'] as const)
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminUpdateConfigDto {
  // value is any JSON-serialisable value; validated by ConfigurationService
  value!: unknown;
}

export class AdminFeeSweepDto {
  @IsString()
  @IsNotEmpty()
  destination_address!: string;

  @IsEnum(['usdc', 'usdt'] as const)
  currency!: Currency;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface ConfigurationDto {
  id: string;
  config_key: string;
  config_value: unknown;
  description: string;
  updated_at: string;
}

export interface FeeSweepResponseDto {
  ledger_transaction_id: string;
}

export interface ConsolidationResponseDto {
  triggered: boolean;
  message: string;
  pyusd_triggered: boolean;
  pyusd_message: string;
}

export interface TreasuryDto {
  master_wallet: {
    public_key: string;
    usdc_balance: number;
    usdt_balance: number;
    pyusd_balance: number;
    total_balance: number;
    last_synced_at: string;
  };
  fee_account: {
    balance: number;
    pending_fees_estimate: number;
    total_fees_exposure: number;
    available_to_sweep: boolean;
  };
  ledger: {
    total_user_balances: number;
    total_escrow_balances: number;
  };
}

// ─── COA Admin DTOs ───────────────────────────────────────────────────────────

export interface AdminCoaDto {
  id: string;
  sample_id: string;
  campaign_id: string;
  campaign_title: string;
  campaign_verification_code: number;
  sample_label: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  uploaded_at: string;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
  ocr_text: string | null;
  lab_name: string;
  test_names: string[];
  sample_mass: string | null;
  creator_id: string;
  creator_email: string;
  creator_username: string | null;
  rejection_count: number;
}
