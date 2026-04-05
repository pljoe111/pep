import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import type { ClaimKind } from './campaign.dto';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type EndotoxinMode = 'exact_value' | 'pass_fail';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class CreateLabDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone_number?: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;
}

export class UpdateLabDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateLabTestDto {
  @IsUUID()
  test_id!: string;

  @IsNumber()
  @Min(0.01)
  price_usd!: number;

  @IsInt()
  @Min(1)
  typical_turnaround_days!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  vials_required?: number;

  @IsOptional()
  @IsEnum(['exact_value', 'pass_fail'] as const)
  endotoxin_mode?: EndotoxinMode;
}

export class UpdateLabTestDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price_usd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  typical_turnaround_days?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  vials_required?: number;

  @IsOptional()
  @IsEnum(['exact_value', 'pass_fail'] as const)
  endotoxin_mode?: EndotoxinMode;

  @IsOptional()
  @IsString()
  change_reason?: string;
}

// ─── TestClaimTemplate DTOs ───────────────────────────────────────────────────

export class CreateTestClaimTemplateDto {
  @IsEnum(['mass', 'other', 'purity', 'identity', 'endotoxins', 'sterility'] as const)
  claim_kind!: ClaimKind;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class UpdateTestClaimTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface LabDto {
  id: string;
  name: string;
  phone_number: string | null;
  country: string;
  address: string | null;
  is_approved: boolean;
  is_active: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface TestClaimTemplateDto {
  id: string;
  test_id: string;
  claim_kind: ClaimKind;
  label: string;
  is_required: boolean;
  sort_order: number;
}

export interface LabTestDto {
  id: string;
  lab_id: string;
  test_id: string;
  test_name: string;
  price_usd: number;
  typical_turnaround_days: number;
  vials_required: number;
  endotoxin_mode: EndotoxinMode;
  is_active: boolean;
}

export interface LabDetailDto extends LabDto {
  tests: LabTestDto[];
}

// ─── Test catalog DTOs ────────────────────────────────────────────────────────

export class CreateTestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  usp_code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  vials_required?: number;
}

export class UpdateTestDto {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsString()
  usp_code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  vials_required?: number;
}

export interface TestDto {
  id: string;
  name: string;
  description: string;
  usp_code: string | null;
  is_active: boolean;
  vials_required: number;
  created_at: string;
  claim_templates: TestClaimTemplateDto[];
}
