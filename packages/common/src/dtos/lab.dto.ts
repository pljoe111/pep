import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

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
  @IsString()
  change_reason?: string;
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

export interface LabTestDto {
  id: string;
  lab_id: string;
  test_id: string;
  test_name: string;
  price_usd: number;
  typical_turnaround_days: number;
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
}

export interface TestDto {
  id: string;
  name: string;
  description: string;
  usp_code: string | null;
  is_active: boolean;
  created_at: string;
}
