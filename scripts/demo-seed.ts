// pnpm demo:seed — creates on the real network, for the demo repo:
//   (a) issue #1: a bond left BONDED for the judge
//   (b) issue #2: a bond that was REFUNDED
//   (c) issue #3: a bond that was FORFEITED to charity
//   (d) issue #4: a bond funded early so it is RECLAIMABLE (pre-aged) for the permissionless button
// Idempotent: an issue that already has a bond in the target state is skipped.
// Writes every txid to docs/proof/DEMO_TXIDS.md.
import { SignatureTemplate } from 'cashscript';
import { Chain, getNetwork, lockMinutes, requiredConfirmations } from '@bond/core';
import { buildForfeitTx, buildRefundTx, getBondStatus } from '@bond/contracts';
import { fundBond, loadWallets } from '../tests/lib.js';
import { demoIssue, demoRepo, writeDemoConfig } from './lib/demo.js';
import { record } from './lib/txlog.js';

const w = loadWallets();
const config = writeDemoConfig();
const { owner, repo } = demoRepo();
const SECTION = `demo seed ${owner}/${repo} (${getNetwork().name})`;
const chain = new Chain();
await chain.connect();
const provider = await chain.provider();
const mk = new SignatureTemplate(w.maintainer.privateKey);

console.log(`Seeding ${owner}/${repo} on ${getNetwork().name}; registry ${config.registryAddress}`);
const bal = await chain.getBalance(w.contributor.address);
if (bal < 220_000n) {
  console.error(`Contributor has ${bal} sats; need ~220000. Run pnpm faucet first.`);
  process.exit(1);
}

async function ensure(number: number, target: 'bonded' | 'refunded' | 'forfeited' | 'reclaimable', label: string) {
  const issue = demoIssue(number);
  const st = await getBondStatus(chain, config, issue);
  const has = st.bonds.find((b) =>
    target === 'bonded' || target === 'reclaimable'
      ? b.status === 'bonded' || b.status === 'reclaimable'
      : b.status === target,
  );
  if (has) {
    console.log(`#${number} already ${has.status} (${has.fundingTxid}) — skipping`);
    return;
  }
  const fb = await fundBond(chain, config, issue, w.contributor);
  record(SECTION, `(${label}) fund #${number}`, fb.fundingTxid);
  if (target === 'refunded') {
    record(
      SECTION,
      `(${label}) refund #${number}`,
      await chain.broadcast(buildRefundTx({ bond: fb.bond, utxo: fb.utxo, provider, maintainerKey: mk })),
    );
  } else if (target === 'forfeited') {
    record(
      SECTION,
      `(${label}) forfeit #${number} -> charity`,
      await chain.broadcast(buildForfeitTx({ bond: fb.bond, utxo: fb.utxo, provider, maintainerKey: mk })),
    );
  }
}

try {
  // Fund (d) first so it ages while the others are created.
  await ensure(4, 'reclaimable', 'd: pre-aged for reclaim');
  await ensure(1, 'bonded', 'a: left bonded');
  await ensure(2, 'refunded', 'b: refunded');
  await ensure(3, 'forfeited', 'c: forfeited');
  // Pre-age: wait until the reclaim bond (#4) has passed the network's timelock, so it is
  // reclaimable when judges arrive. (Skip with SEED_NO_WAIT=1; it is just slower, not different.)
  const need = requiredConfirmations(config.reclaimBlocks);
  console.log(`
Waiting for #4 to be reclaimable (${need} confirmations, ~${lockMinutes(config.reclaimBlocks)} min)...`);
  const deadline = Date.now() + 30 * 60 * 1000;
  while (!process.env.SEED_NO_WAIT && Date.now() < deadline) {
    const st = await getBondStatus(chain, config, demoIssue(4));
    if (st.status === 'reclaimable') break;
    if (st.status !== 'bonded') break; // already spent (e.g. reclaimed earlier)
    await new Promise((r) => setTimeout(r, 30_000));
  }
  for (const n of [1, 2, 3, 4]) {
    const st = await getBondStatus(chain, config, demoIssue(n));
    console.log(`#${n}: ${st.status}`);
  }
  console.log(`
Txids: docs/proof/DEMO_TXIDS.md. Do NOT press the reclaim button on #4 if you want judges to see it.`);
} finally {
  await chain.close();
}
process.exit(0);
