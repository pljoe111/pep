import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

// ─── String literal types mirroring Prisma enums ─────────────────────────────
// (Prisma enums are imported from @prisma/client in bff service code per rule 2.4;
//  common intentionally uses string literal types to avoid coupling to @prisma/client)

export type ClaimType =
  | 'campaign_creator'
  | 'contributor'
  | 'user_submitted_data_approver'
  | 'admin';

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface UserStatsDto {
  total_contributed_usd: number;
  campaigns_created: number;
  campaigns_successful: number;
  campaigns_refunded: number;
}

export interface UserDto {
  id: string;
  email: string;
  username: string | null;
  is_banned: boolean;
  email_verified: boolean;
  claims: ClaimType[];
  stats: UserStatsDto;
  created_at: string; // ISO 8601
}

export interface PublicUserProfileDto {
  id: string;
  username: string | null;
  stats: {
    total_contributed_usd: number;
    campaigns_created: number;
    campaigns_successful: number;
  };
  created_at: string;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class NotificationPreferenceChannelDto {
  email!: boolean;
  in_app!: boolean;
}

export class NotificationPreferencesDto {
  @IsOptional()
  campaign_funded?: NotificationPreferenceChannelDto;

  @IsOptional()
  campaign_locked?: NotificationPreferenceChannelDto;

  @IsOptional()
  samples_shipped?: NotificationPreferenceChannelDto;

  @IsOptional()
  coa_uploaded?: NotificationPreferenceChannelDto;

  @IsOptional()
  campaign_refunded?: NotificationPreferenceChannelDto;

  @IsOptional()
  campaign_resolved?: NotificationPreferenceChannelDto;

  @IsOptional()
  deposit_confirmed?: NotificationPreferenceChannelDto;

  @IsOptional()
  withdrawal_sent?: NotificationPreferenceChannelDto;

  @IsOptional()
  withdrawal_failed?: NotificationPreferenceChannelDto;
}

export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username!: string;
}
