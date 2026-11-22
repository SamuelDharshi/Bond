// pnpm reclaim <issue-url> [config-path] — permissionless: return every timed-out bond on an issue
// to its contributor. Uses NO private key, only public chain data and the repo's bond.json.
import { readFileSync } from 'node:fs';
import { Chain, getNetwork, isTimelockNotReached, notYetMessage, parseBondConfig, parseIssueUrl } from '@bond/core';
import { buildReclaimTx, getBondStatus } from '@bond/contracts';
import { DEMO_CONFIG_PATH } from './lib/demo.js';
import { loadEnv } from './lib/env.js';
import { record } from './lib/txlog.js';

loadEnv();
const [url, cfgPath = DEMO_CONFIG_PATH] = process.argv.slice(2);
if (!url) {
  console.error('usage: pnpm reclaim <github-issue-url> [path/to/bond.json]');
  process.exit(1);
}
const issue = parseIssueUrl(url);
const config = parseBondConfig(JSON.parse(readFileSync(cfgPath, 'utf8')));
const chain = new Chain();
try {
  const { status, bonds } = await getBondStatus(chain, config, issue);
  console.log(`${issue.owner}/${issue.repo}#${issue.number}: ${status}`);
  for (const b of bonds) {
    if (b.status !== 'reclaimable' || !b.utxo) {
      console.log(`  ${b.fundingTxid}: ${b.status} (${b.confirmations}/${config.reclaimBlocks} conf)`);
      continue;
    }
    try {
      const txid = await chain.broadcast(
        buildReclaimTx({ bond: b.bond, utxo: b.utxo, provider: await chain.provider() }),
      );
      record(`reclaim (${getNetwork().name})`, `reclaim ${issue.owner}/${issue.repo}#${issue.number}`, txid);
    } catch (e) {
      if (!isTimelockNotReached(e)) throw e;
      console.log(`  ${b.fundingTxid}: ${notYetMessage(b.confirmations, config.reclaimBlocks)}`);
    }
  }
} finally {
  await chain.close();
}
process.exit(0);
