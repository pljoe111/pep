import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// ─── Shared type ──────────────────────────────────────────────────────────────

export type VendorStatus = 'pending' | 'approved' | 'rejected';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  website?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  telegram_group?: string;

  @IsOptional()
  @IsString()
  contact_notes?: string;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  telegram_group?: string;

  @IsOptional()
  @IsString()
  contact_notes?: string;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'] as const)
  status?: VendorStatus;
}

export class ReviewVendorDto {
  @IsEnum(['approved', 'rejected'] as const)
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  review_notes?: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface VendorDto {
  id: string;
  name: string;
  website: string | null;
  country: string | null;
  telegram_group: string | null;
  contact_notes: string | null;
  status: VendorStatus;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Lightweight shape returned by the vendor search endpoint */
export interface VendorSummaryDto {
  id: string;
  name: string;
  website: string | null;
  country: string | null;
  status: VendorStatus;
}
