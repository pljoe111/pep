import { inject } from 'tsyringe';
import { Controller, Get, Route, Tags, SuccessResponse } from 'tsoa';
import type { AppInfoDto } from 'common';
import { env } from '../config/env.config';
import {
  ConfigurationService,
  type GlobalMinimumsConfig,
  type MaxCampaignMultiplierConfig,
  type DepositConversionFeeBpsConfig,
} from '../services/configuration.service';

@Route('app-info')
@Tags('AppInfo')
export class AppInfoController extends Controller {
  constructor(@inject(ConfigurationService) private readonly configService: ConfigurationService) {
    super();
  }

  /**
   * GET /app-info — spec §9.13
   */
  @Get('/')
  @SuccessResponse('200', 'OK')
  public async getAppInfo(): Promise<AppInfoDto> {
    const [minimums, feeConfig, multiplierConfig, conversionFeeConfig] = await Promise.all([
      this.configService.get<GlobalMinimumsConfig>('global_minimums'),
      this.configService.get<{ value: number }>('platform_fee_percent'),
      this.configService.get<MaxCampaignMultiplierConfig>('max_campaign_multiplier'),
      this.configService.get<DepositConversionFeeBpsConfig>('deposit_conversion_fee_bps'),
    ]);

    // deposit_conversion_fee_bps is stored as a plain number in the DB (not wrapped in { value })
    const conversionFeeBps =
      typeof conversionFeeConfig === 'number' ? conversionFeeConfig : conversionFeeConfig.value;

    return {
      version: env.APP_VERSION,
      network: env.SOLANA_NETWORK,
      usdc_mint: env.USDC_MINT,
      usdt_mint: env.USDT_MINT,
      pyusd_mint: env.PYUSD_MINT,
      deposit_conversion_fee_bps: conversionFeeBps,
      minimums,
      platform_fee_percent: feeConfig.value,
      max_campaign_multiplier: multiplierConfig.value,
    };
  }
}
