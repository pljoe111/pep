import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── String literal types mirroring Prisma enums ─────────────────────────────

export type CampaignStatus =
  | 'created'
  | 'funded'
  | 'samples_sent'
  | 'results_published'
  | 'resolved'
  | 'refunded';

export type ReactionType = 'thumbs_up' | 'rocket' | 'praising_hands' | 'mad' | 'fire';

export type VerificationStatus =
  | 'pending'
  | 'code_found'
  | 'code_not_found'
  | 'manually_approved'
  | 'rejected';

export type ClaimKind = 'mass' | 'other';
export type UpdateType = 'text' | 'state_change';

// ─── Nested request sub-objects ───────────────────────────────────────────────

export class SampleClaimInputDto {
  @IsEnum(['mass', 'other'] as const)
  claim_type!: ClaimKind;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mass_amount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mass_unit?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  other_description?: string;
}

export class TestRequestInputDto {
  @IsUUID()
  test_id!: string;
}

export class SampleInputDto {
  @IsString()
  @IsNotEmpty()
  vendor_name!: string;

  @IsString()
  @IsNotEmpty()
  purchase_date!: string; // ISO date string YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  physical_description!: string;

  @IsString()
  @IsNotEmpty()
  sample_label!: string;

  @IsUUID()
  target_lab_id!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order_index?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleClaimInputDto)
  claims!: SampleClaimInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestRequestInputDto)
  tests!: TestRequestInputDto[];
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  description!: string;

  @IsNumber()
  @Min(0.01)
  amount_requested_usd!: number;

  @IsInt()
  @Min(5)
  @Max(100)
  funding_threshold_percent!: number;

  @IsBoolean()
  @IsOptional()
  is_itemized?: boolean;

  @IsOptional()
  itemization_data?: unknown;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleInputDto)
  samples!: SampleInputDto[];
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_itemized?: boolean;

  @IsOptional()
  itemization_data?: unknown;
}

export class AddCampaignUpdateDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class AddReactionDto {
  @IsEnum(['thumbs_up', 'rocket', 'praising_hands', 'mad', 'fire'] as const)
  reaction_type!: ReactionType;
}

// ─── Response sub-shapes ──────────────────────────────────────────────────────

export interface SampleClaimDto {
  id: string;
  claim_type: ClaimKind;
  mass_amount: number | null;
  mass_unit: string | null;
  other_description: string | null;
}

export interface TestInfoDto {
  id: string;
  test_id: string;
  name: string;
  usp_code: string | null;
}

export interface CoaDto {
  id: string;
  sample_id: string;
  /** Pre-signed S3 URL, TTL from S3_SIGNED_URL_TTL_SECONDS */
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  uploaded_at: string;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
}

export interface SampleDto {
  id: string;
  vendor_name: string;
  purchase_date: string; // ISO date YYYY-MM-DD
  physical_description: string;
  sample_label: string;
  order_index: number;
  target_lab: { id: string; name: string };
  claims: SampleClaimDto[];
  tests: TestInfoDto[];
  coa: CoaDto | null;
}

export interface CampaignUpdateDto {
  id: string;
  campaign_id: string;
  author_id: string;
  content: string;
  update_type: UpdateType;
  state_change_from: string | null;
  state_change_to: string | null;
  created_at: string;
}

export interface ReactionCountsDto {
  thumbs_up: number;
  rocket: number;
  praising_hands: number;
  mad: number;
  fire: number;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface CampaignListDto {
  id: string;
  title: string;
  status: CampaignStatus;
  creator: { id: string; username: string | null };
  amount_requested_usd: number;
  current_funding_usd: number;
  funding_threshold_usd: number;
  /** current_funding_usd / funding_threshold_usd × 100 */
  funding_progress_percent: number;
  is_flagged_for_review: boolean;
  is_hidden: boolean;
  sample_labels: string[];
  deadline_fundraising: string | null;
  /** null if no active deadline */
  time_remaining_seconds: number | null;
  created_at: string;
}

export interface CampaignDetailDto {
  id: string;
  title: string;
  description: string;
  status: CampaignStatus;
  creator: { id: string; username: string | null; successful_campaigns: number };
  verification_code: number;
  amount_requested_usd: number;
  estimated_lab_cost_usd: number;
  current_funding_usd: number;
  funding_threshold_usd: number;
  funding_threshold_percent: number;
  funding_progress_percent: number;
  platform_fee_percent: number;
  is_flagged_for_review: boolean;
  flagged_reason: string | null;
  is_itemized: boolean;
  itemization_data: unknown;
  samples: SampleDto[];
  updates: CampaignUpdateDto[];
  reactions: ReactionCountsDto;
  /** null if unauthenticated or no reaction */
  my_reaction: ReactionType | null;
  deadlines: {
    fundraising: string | null;
    ship_samples: string | null;
    publish_results: string | null;
  };
  timestamps: {
    created_at: string;
    funded_at: string | null;
    locked_at: string | null;
    samples_sent_at: string | null;
    results_published_at: string | null;
    resolved_at: string | null;
    refunded_at: string | null;
  };
  refund_reason: string | null;
}

export interface LabCostBreakdownDto {
  lab_id: string;
  lab_name: string;
  test_id: string;
  test_name: string;
  price_usd: number;
}

export interface EstimateCostResponseDto {
  estimated_usd: number;
  breakdown: LabCostBreakdownDto[];
}

export interface VerificationCodeResponseDto {
  code: number;
}
