/** Global platform minimums — mirrors the 'global_minimums' Configuration row. */
export interface GlobalMinimumsConfig {
  min_contribution_usd: number;
  min_funding_threshold_usd: number;
  min_funding_threshold_percent: number;
  min_withdrawal_usd: number;
}

/** GET /app-info response — spec §9.13 */
export interface AppInfoDto {
  version: string;
  /** 'devnet' | 'mainnet-beta' | 'testnet' */
  network: string;
  usdc_mint: string;
  usdt_mint: string;
  minimums: GlobalMinimumsConfig;
  platform_fee_percent: number;
  max_campaign_multiplier: number;
}
