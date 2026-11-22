// pnpm balance — real balances from Electrum.
import { Chain, getNetwork } from '@bond/core';
import { optionalKey } from './lib/env.js';

const chain = new Chain();
try {
  await chain.connect();
  console.log(`Network ${getNetwork().name} via ${chain.connectedHost}, tip ${await chain.getTipHeight()}`);
  for (const role of ['MAINTAINER', 'CONTRIBUTOR', 'CHARITY']) {
    const k = optionalKey(`${role}_WIF`);
    if (!k) {
      console.log(`${role.padEnd(11)} (missing — run pnpm wallets:new)`);
      continue;
    }
    const utxos = await chain.getUtxos(k.address);
    const sats = utxos.reduce((a, u) => a + u.satoshis, 0n);
    console.log(`${role.padEnd(11)} ${k.address}  ${sats.toString().padStart(10)} sats  (${utxos.length} utxos)`);
  }
} finally {
  await chain.close();
}
process.exit(0);
