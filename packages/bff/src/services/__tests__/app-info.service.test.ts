import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { GlobalMinimumsConfig } from 'common';
import type { ConfigurationService } from '../../services/configuration.service';

// Set required env vars before importing anything that triggers env validation.
// Dynamic imports inside each test ensure modules load AFTER this beforeAll.
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/test';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters!!';
  process.env.USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  process.env.USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  process.env.MASTER_WALLET_PUBLIC_KEY = '11111111111111111111111111111111';
  process.env.MASTER_WALLET_PRIVATE_KEY =
    '5NemXetH19TAcuBd4ABz3URRDmxRPNrDDXFfgvzPT6KZkxGNv6kD3ZKuvjpgBN8GXbVCF8TkU9tMZPU6LEKF5qes';
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});

const mockMinimums: GlobalMinimumsConfig = {
  min_contribution_usd: 10,
  min_funding_threshold_usd: 1000,
  min_funding_threshold_percent: 50,
  min_withdrawal_usd: 10,
};

describe('AppInfo endpoint shape', () => {
  it('returns an object with version, network, usdc_mint, usdt_mint, and minimums fields', async () => {
    const { AppInfoController } = await import('../../controllers/app-info.controller');

    const getMock = vi
      .fn<[string], Promise<GlobalMinimumsConfig>>()
      .mockResolvedValue(mockMinimums);
    // SAFETY: only the `get` method is called by the controller; partial mock is sufficient.
    const mockConfigService = { get: getMock } as unknown as ConfigurationService;

    const controller = new AppInfoController(mockConfigService);
    const result = await controller.getAppInfo();

    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('network');
    expect(result).toHaveProperty('usdc_mint');
    expect(result).toHaveProperty('usdt_mint');
    expect(result).toHaveProperty('minimums');
    expect(typeof result.version).toBe('string');
    expect(typeof result.network).toBe('string');
    expect(typeof result.usdc_mint).toBe('string');
    expect(typeof result.usdt_mint).toBe('string');
    // Strengthened: verify actual values — typeof passes for "", these do not.
    expect(result.usdc_mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(result.usdt_mint).toBe('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
    expect(result.version).toBeTruthy();
    expect(result.network).toBeTruthy();
  });

  it('minimums are sourced from ConfigurationService with key global_minimums', async () => {
    const { AppInfoController } = await import('../../controllers/app-info.controller');

    const getMock = vi
      .fn<[string], Promise<GlobalMinimumsConfig>>()
      .mockResolvedValue(mockMinimums);
    // SAFETY: only the `get` method is called by the controller; partial mock is sufficient.
    const mockConfigService = { get: getMock } as unknown as ConfigurationService;

    const controller = new AppInfoController(mockConfigService);
    const result = await controller.getAppInfo();

    expect(result.minimums).toEqual(mockMinimums);
    expect(getMock).toHaveBeenCalledWith('global_minimums');
  });

  it('propagates rejection when ConfigurationService.get rejects', async () => {
    const { AppInfoController } = await import('../../controllers/app-info.controller');

    const getMock = vi
      .fn<[string], Promise<GlobalMinimumsConfig>>()
      .mockRejectedValue(new Error('config DB unavailable'));
    // SAFETY: only the `get` method is called by the controller.
    const mockConfigService = { get: getMock } as unknown as ConfigurationService;

    const controller = new AppInfoController(mockConfigService);
    await expect(controller.getAppInfo()).rejects.toThrow('config DB unavailable');
  });
});
