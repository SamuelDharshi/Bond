// pnpm mainnet:proof — one REAL mainnet round trip for the repo in .github/bond.json.
//
//   bond A: lock the minimum deposit, maintainer REFUNDS it        (contributor gets it back, minus a tiny fee)
//   bond B: lock the minimum deposit, maintainer FORFEITS it       (goes to the charity address in bond.json)
//
// Spends real BCH, so it refuses to run unless BCH_NETWORK=mainnet and MAINNET_CONFIRM=yes are both set.
// Keys come from .env (MAINNET_CONTRIBUTOR_WIF, MAINNET_MAINTAINER_WIF) and are never printed.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SignatureTemplate } from 'cashscript';
import { Chain, getNetwork, parseBondConfig, type IssueRef } from '@bond/core';
import { buildForfeitTx, buildRefundTx } from '@bond/contracts';
import { fundBond, sleep, waitFor } from '../tests/lib.js';
import { ROOT, loadEnv, requireKey } from './lib/env.js';
import { record, resetSection } from './lib/txlog.js';

loadEnv();
const net = getNetwork();
if (net.isTestnet || process.env.MAINNET_CONFIRM !== 'yes') {
  console.error('Refusing to run. Set BCH_NETWORK=mainnet and MAINNET_CONFIRM=yes (this spends real BCH).');
  process.exit(1);
}

const config = parseBondConfig(JSON.parse(readFileSync(resolve(ROOT, '.github', 'bond.json'), 'utf8')));
const contributor = requireKey('MAINNET_CONTRIBUTOR_WIF');
const maintainer = requireKey('MAINNET_MAINTAINER_WIF');
if (maintainer.pkhHex !== config.maintainerPkh) throw new Error('MAINNET_MAINTAINER_WIF does not match bond.json');

const [owner, repo] = (process.env.BOND_PROOF_REPO || 'SamuelDharshi/Bond').split('/');
const issue = (number: number): IssueRef => ({ owner, repo, number });
const SECTION = 'mainnet';
const NEED = BigInt(config.minValueSats) * 2n + 20_000n;

const chain = new Chain();
await chain.connect();
try {
  const balance = await chain.getBalance(contributor.address);
  console.log(`Network ${net.name} via ${chain.connectedHost}`);
  console.log(`Contributor ${contributor.address} holds ${balance} sats (needs about ${NEED})`);
  if (balance < NEED) throw new Error('Not enough BCH in the contributor wallet for two test bonds.');
  resetSection(SECTION);
  const maintainerKey = new SignatureTemplate(maintainer.privateKey);
  const provider = await chain.provider();

  for (const [kind, number] of [
    ['refund', 1],
    ['forfeit', 2],
  ] as const) {
    const funded = await fundBond(chain, config, issue(number), contributor);
    console.log(`\n#${number} locked: ${net.explorerTx(funded.fundingTxid)}`);
    record(SECTION, `fund: bond #${number}`, funded.fundingTxid);

    const args = { bond: funded.bond, utxo: funded.utxo, provider, maintainerKey };
    const hex = kind === 'refund' ? buildRefundTx(args) : buildForfeitTx(args);
    const spendTxid = await chain.broadcast(hex);
    console.log(`#${number} ${kind}: ${net.explorerTx(spendTxid)}`);
    record(SECTION, `${kind}: bond #${number}`, spendTxid);
    await sleep(1500);
  }

  // Prove the end state from the chain, not from our own bookkeeping.
  const gone = await waitFor(
    'bonds spent',
    async () => ((await chain.getUtxos(contributor.address)).length > 0 ? true : undefined),
    30_000,
    2000,
  );
  console.log(
    `\nContributor wallet after the test: ${await chain.getBalance(contributor.address)} sats`,
    gone ? '' : '',
  );
} finally {
  await chain.close();
}
process.exit(0);
