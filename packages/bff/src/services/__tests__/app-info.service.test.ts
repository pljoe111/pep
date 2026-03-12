import { describe, it, expect, beforeAll } from 'vitest';

// Set required env vars before importing anything that triggers env validation
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/test';
  process.env.NODE_ENV = 'test';
});

describe('AppInfo endpoint shape', () => {
  it('returns an object with name, version, and environment fields', async () => {
    // Dynamically import to ensure env is set first
    const { AppInfoController } = await import('../../controllers/app-info.controller');
    const controller = new AppInfoController();
    const result = controller.getAppInfo();

    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('environment');

    expect(typeof result.name).toBe('string');
    expect(typeof result.version).toBe('string');
    expect(typeof result.environment).toBe('string');
  });

  it('environment matches NODE_ENV', async () => {
    const { AppInfoController } = await import('../../controllers/app-info.controller');
    const controller = new AppInfoController();
    const result = controller.getAppInfo();

    expect(result.environment).toBe(process.env.NODE_ENV ?? 'development');
  });
});
