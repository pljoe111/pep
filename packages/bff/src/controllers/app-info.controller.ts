import { inject } from 'tsyringe';
import { Controller, Get, Route, Tags, SuccessResponse } from 'tsoa';
import type { AppInfoDto } from 'common';
import { env } from '../config/env.config';
import {
  ConfigurationService,
  type GlobalMinimumsConfig,
  type MaxCampaignMultiplierConfig,
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
    const [minimums, feeConfig, multiplierConfig] = await Promise.all([
      this.configService.get<GlobalMinimumsConfig>('global_minimums'),
      this.configService.get<{ value: number }>('platform_fee_percent'),
      this.configService.get<MaxCampaignMultiplierConfig>('max_campaign_multiplier'),
    ]);

    return {
      version: env.APP_VERSION,
      network: env.SOLANA_NETWORK,
      usdc_mint: env.USDC_MINT,
      usdt_mint: env.USDT_MINT,
      minimums,
      platform_fee_percent: feeConfig.value,
      max_campaign_multiplier: multiplierConfig.value,
    };
  }
}
