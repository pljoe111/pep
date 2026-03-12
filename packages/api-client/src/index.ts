/**
 * api-client
 *
 * Auto-generated TypeScript/Axios client from the BFF's OpenAPI spec.
 * DO NOT hand-edit this file — run `pnpm generate:client` from the repo root.
 *
 * After generation, this file re-exports everything from the generated output
 * and provides a convenience factory for consuming apps.
 */

// Re-export everything from generated code
export * from './generated';

import axios from 'axios';
import { AppInfoApi, Configuration } from './generated';

/**
 * Creates all API clients sharing a single Axios instance.
 * @param basePath - The base URL of the BFF (e.g. "http://localhost:3000/api")
 */
export function createApiClient(basePath: string): {
  appInfo: AppInfoApi;
} {
  const axiosInstance = axios.create({
    baseURL: basePath,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const configuration = new Configuration({ basePath });

  return {
    appInfo: new AppInfoApi(configuration, basePath, axiosInstance),
  };
}
