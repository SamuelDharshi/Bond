import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

export default defineConfig(({ mode }) => {
  // Read the monorepo .env so BCH_NETWORK is the ONE switch for web too. Only VITE_* reach client code
  // via import.meta.env; BCH_NETWORK / BCH_ELECTRUM_SERVERS are injected explicitly below.
  const env = { ...loadEnv(mode, ROOT, ''), ...process.env };
  // Production defaults to mainnet and ignores the local .env (which holds the chipnet dev setting).
  // Dev uses .env. Visitors can switch with the in-app "Practice on testnet" toggle.
  const network = mode === 'production' ? process.env.BCH_NETWORK || 'mainnet' : env.BCH_NETWORK || 'chipnet';
  return {
    base: env.VITE_BASE || '/',
    envDir: ROOT,
    plugins: [react()],
    define: {
      __BCH_NETWORK__: JSON.stringify(network),
      __BCH_ELECTRUM_SERVERS__: JSON.stringify(env.BCH_ELECTRUM_SERVERS || ''),
    },
    resolve: {
      alias: [
        { find: /^@proof-txids$/, replacement: resolve(ROOT, 'docs/proof/txids.json') },
        { find: /^@bond-source(?=\?raw$)/, replacement: resolve(ROOT, 'packages/contracts/Bond.cash') },
      ],
    },
    server: { fs: { allow: [ROOT] } },
    build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 2000 },
  };
});
