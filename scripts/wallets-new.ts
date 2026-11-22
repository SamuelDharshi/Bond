// pnpm wallets:new — generate maintainer / contributor / charity wallets into .env.
// Never overwrites an existing key.
import { getNetwork, keyFromWif, newKey } from '@bond/core';
import { loadEnv, setEnvVar } from './lib/env.js';

loadEnv();
const net = getNetwork();
setEnvVar('BCH_NETWORK', net.name);

for (const role of ['MAINTAINER', 'CONTRIBUTOR', 'CHARITY'] as const) {
  const name = `${role}_WIF`;
  const existing = process.env[name];
  if (existing) {
    const k = keyFromWif(existing);
    console.log(`${role.padEnd(11)} (kept)    ${k.address}  pkh=${k.pkhHex}`);
    continue;
  }
  const k = newKey();
  setEnvVar(name, k.wif);
  console.log(`${role.padEnd(11)} (new)     ${k.address}  pkh=${k.pkhHex}`);
}

console.log(`\nNetwork: ${net.name}. Keys are in .env (gitignored). Next: pnpm faucet`);
