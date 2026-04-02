import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { ClaimType } from './user.dto';
import type { Currency } from './wallet.dto';

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

export class AdminBanUserDto {
  @IsBoolean()
  banned!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminClaimDto {
  @IsEnum(['campaign_creator', 'contributor', 'lab_approver', 'admin'] as const)
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
}
