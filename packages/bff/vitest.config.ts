import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run all test files sequentially in a single thread.
    // Required because integration tests share a single PostgreSQL instance and
    // SERIALIZABLE transactions from concurrent files trigger SSI write-conflicts (P2034).
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'src/generated/'],
    },
    setupFiles: ['reflect-metadata'],
  },
});
