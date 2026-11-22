// pnpm faucet — request chipnet coins for the contributor (and maintainer) wallets.
//
// tbch.googol.cash protects drips with a "sum of two numbers" image captcha. We fetch the
// captcha with a session cookie, save the PNG, and (on an interactive terminal) ask you to type
// the sum. Non-interactive: pass FAUCET_CAPTCHA=<sum> after viewing the saved image, or follow the
// manual instructions printed at the end.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Chain, getNetwork } from '@bond/core';
import { ROOT, optionalKey } from './lib/env.js';

const FAUCET = 'https://tbch.googol.cash';
const net = getNetwork();
if (!net.isTestnet) {
  console.error(`Refusing to run the faucet on ${net.name} (not a test network).`);
  process.exit(1);
}

async function drip(address: string): Promise<string | undefined> {
  const capRes = await fetch(`${FAUCET}/captcha`);
  const cookie = (capRes.headers.get('set-cookie') ?? '').split(';')[0];
  const png = Buffer.from(await capRes.arrayBuffer());
  const imgPath = resolve(ROOT, '.faucet-captcha.png');
  writeFileSync(imgPath, png);
  let answer = process.env.FAUCET_CAPTCHA;
  if (!answer && process.stdin.isTTY) {
    console.log(`Captcha saved to ${imgPath} — open it and type the sum of the numbers.`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    answer = (await rl.question('Sum: ')).trim();
    rl.close();
  }
  if (!answer) {
    console.log(`Captcha saved to ${imgPath}. Re-run with FAUCET_CAPTCHA=<sum> pnpm faucet`);
    return undefined;
  }
  const url = `${FAUCET}/greet?address=${encodeURIComponent(address)}&captcha=${encodeURIComponent(answer)}&network=${net.name}`;
  const res = await fetch(url, { headers: { cookie } });
  const body = (await res.json().catch(() => ({}))) as { tx_id?: string; amount?: string; error?: string };
  if (body.tx_id) {
    console.log(`Faucet sent ${body.amount} to ${address}: ${net.explorerTx(body.tx_id)}`);
    return body.tx_id;
  }
  console.log(`Faucet refused: ${body.error ?? res.status}`);
  return undefined;
}

const targets = (process.env.FAUCET_ROLES ?? 'CONTRIBUTOR').split(',');
let ok = false;
for (const role of targets) {
  const k = optionalKey(`${role}_WIF`);
  if (!k) {
    console.log(`${role}_WIF missing — run pnpm wallets:new`);
    continue;
  }
  try {
    if (await drip(k.address)) ok = true;
  } catch (e) {
    console.log(`Faucet request failed: ${(e as Error).message}`);
  }
}

if (!ok) {
  const c = optionalKey('CONTRIBUTOR_WIF');
  console.log(`
Manual funding:
  1. Open https://tbch.googol.cash, choose "${net.name}", paste ${c?.address ?? '<contributor address>'}, solve the captcha.
  2. Or send ${net.name} coins from any wallet running on ${net.name} to that address.
The contributor needs ~300,000 sats for the full e2e suite (each bond is 50,000 sats).
`);
}

const chain = new Chain();
try {
  const c = optionalKey('CONTRIBUTOR_WIF');
  if (c) console.log(`Contributor balance now: ${await chain.getBalance(c.address)} sats (mempool included)`);
} finally {
  await chain.close();
}
process.exit(0);
