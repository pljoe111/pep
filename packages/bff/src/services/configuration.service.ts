/**
 * ConfigurationService — reads and caches platform configuration from the DB.
 *
 * Per coding rules §3.7: all config values MUST be read through this service.
 * Never hardcode values that exist in the configuration table.
 *
 * Keys seeded at migration time (spec §4.23):
 *   valid_mass_units, global_minimums, platform_fee_percent,
 *   max_campaign_multiplier, auto_flag_threshold_usd,
 *   max_withdrawal_per_day, max_file_size_bytes
 */
import { injectable, inject } from 'tsyringe';
import pino from 'pino';
import { PrismaService } from './prisma.service';
import type { ConfigurationDto } from 'common';

const logger = pino({ name: 'ConfigurationService' });

// ─── Well-known config value shapes ──────────────────────────────────────────

export interface ValidMassUnitsConfig {
  units: string[];
}

export interface GlobalMinimumsConfig {
  min_contribution_usd: number;
  min_funding_threshold_usd: number;
  min_funding_threshold_percent: number;
  min_withdrawal_usd: number;
  min_creator_balance_usd: number;
}

export interface PlatformFeeConfig {
  value: number;
}

export interface MaxCampaignMultiplierConfig {
  value: number;
}

export interface AutoFlagThresholdConfig {
  value: number;
}

export interface MaxWithdrawalPerDayConfig {
  value: number;
}

export interface MaxFileSizeConfig {
  value: number;
}

export interface DefaultSweepWalletConfig {
  address: string;
}

export interface DepositConversionFeeBpsConfig {
  value: number; // basis points, e.g. 50 = 0.50%
}

// ─── Cache entry ──────────────────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

@injectable()
export class ConfigurationService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(@inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Get a typed config value by key. Caches for 60 seconds.
   * Throws InternalError if the key is not found.
   */
  async get<T>(key: string): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.value as T;
    }

    const row = await this.prisma.configuration.findUnique({
      where: { config_key: key },
    });

    if (row === null) {
      logger.warn({ key }, 'Configuration key not found');
      throw new Error(`Configuration key "${key}" not found`);
    }

    this.cache.set(key, { value: row.config_value, expiresAt: now + CACHE_TTL_MS });
    return row.config_value as T;
  }

  /** Invalidate a cached key (useful after admin PUT /admin/config/:key). */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Get all configuration rows for the admin endpoint. */
  async getAll(): Promise<ConfigurationDto[]> {
    const rows = await this.prisma.configuration.findMany({
      orderBy: { config_key: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      config_key: row.config_key,
      config_value: row.config_value,
      description: row.description,
      updated_at: row.updated_at.toISOString(),
    }));
  }

  /** Update a config value and invalidate cache. */
  async set(key: string, value: unknown, updatedByUserId: string): Promise<ConfigurationDto> {
    // SAFETY: value is admin-supplied JSON; Prisma accepts it as InputJsonValue.
    const row = await this.prisma.configuration.update({
      where: { config_key: key },
      data: {
        config_value: value as Parameters<
          typeof this.prisma.configuration.update
        >[0]['data']['config_value'],
        updated_by_user_id: updatedByUserId,
      },
    });

    this.invalidate(key);

    return {
      id: row.id,
      config_key: row.config_key,
      config_value: row.config_value,
      description: row.description,
      updated_at: row.updated_at.toISOString(),
    };
  }
}
