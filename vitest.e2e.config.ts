import { defineConfig } from 'vitest/config';
// Real-chain integration suite. Runs sequentially: tests share wallets and must not race UTXOs.
export default defineConfig({
  test: {
    include: ['tests/**/*.e2e.ts'],
    environment: 'node',
    testTimeout: 45 * 60 * 1000,
    hookTimeout: 10 * 60 * 1000,
    fileParallelism: false,
    sequence: { concurrent: false },
    reporters: ['verbose'],
  },
});
