import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class CreatePeptideDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePeptideDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface PeptideDto {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  is_active: boolean;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

/** Lightweight shape used in wizard dropdowns */
export interface PeptideSummaryDto {
  id: string;
  name: string;
  aliases: string[];
  is_active: boolean;
}
