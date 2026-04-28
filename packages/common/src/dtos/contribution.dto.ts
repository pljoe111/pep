import { IsEnum, IsNumber, Min } from 'class-validator';
import type { Currency } from './wallet.dto';

export type ContributionStatus = 'completed' | 'refunded';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class ContributeDto {
  @IsNumber()
  @Min(0.000001)
  amount!: number;

  @IsEnum(['usdc', 'usdt', 'pyusd'] as const)
  currency!: Currency;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface ContributionDto {
  id: string;
  campaign_id: string;
  campaign_title: string;
  contributor: {
    id: string;
    username: string | null;
  };
  amount_usd: number;
  currency: Currency;
  status: ContributionStatus;
  contributed_at: string;
  refunded_at: string | null;
}
