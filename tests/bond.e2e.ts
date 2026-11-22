/**
 * pnpm e2e — full on-chain integration suite against the network in BCH_NETWORK (chipnet).
 * No mocks: every tx is built, signed and broadcast to real Fulcrum servers; every negative case
 * is rejected by the node and/or the CashScript VM evaluator, and the reason is asserted.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SignatureTemplate, TransactionBuilder } from 'cashscript';
import {
  BroadcastError,
  Chain,
  binToHex,
  encodeLockingBytecodeP2pkh,
  equalBytes,
  getNetwork,
  isTimelockNotReached,
  lockMinutes,
  requiredConfirmations,
  newKey,
  type BondConfig,
} from '@bond/core';
import {
  buildForfeitTx,
  buildReclaimTx,
  buildRefundTx,
  discoverBonds,
  getBondStatus,
  spendBuilder,
} from '@bond/contracts';
import { fundBond, loadWallets, sleep, testConfig, uniqueRepo, waitFor, type FundedBond, type Wallets } from './lib.js';
import { record, resetSection } from '../scripts/lib/txlog.js';

const SECTION = `e2e run (${getNetwork().name})`;
const RECLAIM_WAIT_MS = 40 * 60 * 1000;

let chain: Chain;
let w: Wallets;
let config: BondConfig;
let maintainerKey: SignatureTemplate;
const owner = 'bond-e2e';
const repo = uniqueRepo('run');
const issue = (number: number) => ({ owner, repo, number });
const attacker = newKey();
let funded = false;

// Bonds created along the way
let refundBond: FundedBond;
let forfeitBond: FundedBond;
let reclaimBond: FundedBond;
let negBond: FundedBond;
const toCleanUp: FundedBond[] = [];

/** Expect the node to reject a raw tx; returns the rejection reason. */
async function expectNodeReject(hex: string, reason: RegExp): Promise<string> {
  let err: unknown;
  try {
    const txid = await chain.broadcast(hex);
    throw new Error(`UNEXPECTED: node accepted invalid tx ${txid}`);
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(BroadcastError);
  const msg = (err as Error).message;
  expect(msg).toMatch(reason);
  return msg;
}

/** Strip CashScript's Bitauth URI (it embeds private keys) from an error message. */
const firstLines = (m: string) => m.split('\n').slice(0, 2).join(' ');

beforeAll(async () => {
  w = loadWallets();
  chain = new Chain();
  await chain.connect();
  config = testConfig(w);
  maintainerKey = new SignatureTemplate(w.maintainer.privateKey);
  const bal = await chain.getBalance(w.contributor.address);
  console.log(
    `network=${getNetwork().name} server=${chain.connectedHost} contributor=${w.contributor.address} balance=${bal}`,
  );
  if (bal < 400_000n) {
    throw new Error(
      `Contributor needs >= 400000 sats for the suite, has ${bal}. Fund ${w.contributor.address} (pnpm faucet) and re-run.`,
    );
  }
  funded = true;
  resetSection(SECTION);
  // Fund the reclaim bond FIRST so it can confirm while the rest of the suite runs.
  reclaimBond = await fundBond(chain, config, issue(4), w.contributor);
  record(SECTION, 'fund: bond for reclaim test (#4)', reclaimBond.fundingTxid);
});

afterAll(async () => {
  // Recover coins from bonds used by negative tests (valid refunds back to the contributor).
  if (funded) {
    for (const b of toCleanUp) {
      try {
        const utxo = (await chain.getUtxos(b.bond.address)).find((u) => u.txid === b.fundingTxid && u.vout === 0);
        if (!utxo) continue;
        const key = equalBytes(b.bond.params.maintainerPkh, w.maintainer.pkh)
          ? maintainerKey
          : new SignatureTemplate(attacker.privateKey);
        const txid = await chain.broadcast(
          buildRefundTx({ bond: b.bond, utxo, provider: await chain.provider(), maintainerKey: key }),
        );
        record(SECTION, `cleanup: refund ${b.issue.owner}/${b.issue.repo}#${b.issue.number}`, txid);
      } catch (e) {
        console.log('cleanup failed:', firstLines((e as Error).message));
      }
    }
  }
  await chain?.close();
});

describe('positive paths (real chain)', () => {
  it('1. funds a bond via the web-app tx builder; UTXO exists at the contract address', async () => {
    refundBond = await fundBond(chain, config, issue(1), w.contributor);
    record(SECTION, 'fund: bond #1', refundBond.fundingTxid);
    const funding = await chain.getTx(refundBond.fundingTxid);
    expect(equalBytes(funding.tx.outputs[0].lockingBytecode, refundBond.bond.lockingBytecode)).toBe(true);
    expect(funding.tx.outputs[0].valueSatoshis).toBe(50_000n);
    expect(binToHex(funding.tx.outputs[1].lockingBytecode).slice(0, 14)).toBe('6a39424f4e4401');
    expect(funding.tx.outputs[2].valueSatoshis).toBe(546n);
    expect(refundBond.utxo.satoshis).toBe(50_000n);
  });

  it('2. refund pays the contributor P2PKH, value >= input - maxFee', async () => {
    const hex = buildRefundTx({
      bond: refundBond.bond,
      utxo: refundBond.utxo,
      provider: await chain.provider(),
      maintainerKey,
    });
    const txid = await chain.broadcast(hex);
    record(SECTION, 'refund #1', txid);
    const tx = (await chain.getTx(txid)).tx;
    expect(equalBytes(tx.outputs[0].lockingBytecode, encodeLockingBytecodeP2pkh(w.contributor.pkh))).toBe(true);
    expect(tx.outputs[0].valueSatoshis).toBeGreaterThanOrEqual(50_000n - BigInt(config.maxFeeSats));
  });

  it('3. forfeit pays the charity address', async () => {
    forfeitBond = await fundBond(chain, config, issue(2), w.contributor);
    record(SECTION, 'fund: bond #2', forfeitBond.fundingTxid);
    const hex = buildForfeitTx({
      bond: forfeitBond.bond,
      utxo: forfeitBond.utxo,
      provider: await chain.provider(),
      maintainerKey,
    });
    const txid = await chain.broadcast(hex);
    record(SECTION, 'forfeit #2 -> charity', txid);
    const tx = (await chain.getTx(txid)).tx;
    expect(equalBytes(tx.outputs[0].lockingBytecode, forfeitBond.bond.params.charityLock)).toBe(true);
    expect(tx.outputs[0].valueSatoshis).toBeGreaterThanOrEqual(50_000n - BigInt(config.maxFeeSats));
  });
});

describe('negative paths (rejected by node + VM)', () => {
  beforeAll(async () => {
    negBond = await fundBond(chain, config, issue(10), w.contributor);
    toCleanUp.push(negBond);
    record(SECTION, 'fund: bond #10 (target of negative tests)', negBond.fundingTxid);
  });

  it('6. refund paying a different address is rejected', async () => {
    const args = {
      bond: negBond.bond,
      utxo: negBond.utxo,
      provider: await chain.provider(),
      maintainerKey,
      overrideTo: attacker.address,
    };
    expect(() => spendBuilder('refund', args).debug()).toThrow(/line 22[\s\S]*LockingBytecodeP2PKH\(contributorPkh\)/);
    const reason = await expectNodeReject(buildRefundTx(args), /mandatory-script-verify-flag-failed|script/i);
    record(SECTION, 'REJECTED refund to attacker', undefined, reason.slice(0, 90));
  });

  it('7. forfeit to a non-charity address is rejected', async () => {
    const args = {
      bond: negBond.bond,
      utxo: negBond.utxo,
      provider: await chain.provider(),
      maintainerKey,
      overrideTo: w.maintainer.address,
    };
    expect(() => spendBuilder('forfeit', args).debug()).toThrow(/line 31[\s\S]*charityLock/);
    const reason = await expectNodeReject(buildForfeitTx(args), /mandatory-script-verify-flag-failed|script/i);
    record(SECTION, 'REJECTED forfeit to maintainer', undefined, reason.slice(0, 90));
  });

  it('8. two bonds spent through one shared output are rejected', async () => {
    const b2 = await fundBond(chain, config, issue(11), w.contributor);
    toCleanUp.push(b2);
    record(SECTION, 'fund: bond #11 (second bond for test 8)', b2.fundingTxid);
    const builder = new TransactionBuilder({ provider: await chain.provider() })
      .addInput(negBond.utxo, negBond.bond.contract.unlock.refund(maintainerKey.publicKey, maintainerKey))
      .addInput(b2.utxo, b2.bond.contract.unlock.refund(maintainerKey.publicKey, maintainerKey))
      .addOutput({ to: w.contributor.address, amount: 50_000n - 1500n }); // pays only ONE bond's worth
    expect(() => builder.debug()).toThrow(/invalid transaction output index/);
    const reason = await expectNodeReject(builder.build(), /mandatory-script-verify-flag-failed|script|index/i);
    record(SECTION, 'REJECTED two bonds -> one output', undefined, reason.slice(0, 90));
  });

  it('9. fee greater than maxFee is rejected', async () => {
    const args = {
      bond: negBond.bond,
      utxo: negBond.utxo,
      provider: await chain.provider(),
      maintainerKey,
      overrideFee: BigInt(config.maxFeeSats) + 500n,
    };
    expect(() => spendBuilder('refund', args).debug()).toThrow(/line 23[\s\S]*maxFee/);
    const reason = await expectNodeReject(buildRefundTx(args), /mandatory-script-verify-flag-failed|script/i);
    record(SECTION, 'REJECTED fee > maxFee', undefined, reason.slice(0, 90));
  });

  it('10. reclaim before the timeout is rejected (non-final / sequence)', async () => {
    // negBond is unconfirmed (age 0 < reclaimBlocks=1).
    const fresh = (await chain.confirmations(negBond.fundingTxid, negBond.bond.address)) === 0;
    const args = { bond: negBond.bond, utxo: negBond.utxo, provider: await chain.provider() };
    if (fresh) {
      const reason = await expectNodeReject(buildReclaimTx(args), /non-BIP68-final/i);
      record(SECTION, 'REJECTED reclaim before timeout', undefined, reason.slice(0, 90));
    }
    // And a sequence below reclaimBlocks fails the CSV check itself, regardless of confirmations.
    expect(() => spendBuilder('reclaim', { ...args, sequenceOverride: 0 }).debug()).toThrow(/line 38[\s\S]*this\.age/);
    const reason2 = await expectNodeReject(
      buildReclaimTx({ ...args, sequenceOverride: 0 }),
      /mandatory-script-verify-flag-failed|non-BIP68-final|script/i,
    );
    record(SECTION, 'REJECTED reclaim with sequence 0', undefined, reason2.slice(0, 90));
  });

  it('11. refund signed by a non-maintainer key is rejected', async () => {
    const args = {
      bond: negBond.bond,
      utxo: negBond.utxo,
      provider: await chain.provider(),
      maintainerKey: new SignatureTemplate(attacker.privateKey),
    };
    expect(() => spendBuilder('refund', args).debug()).toThrow(/line 19[\s\S]*maintainerPkh/);
    const reason = await expectNodeReject(buildRefundTx(args), /mandatory-script-verify-flag-failed|script/i);
    record(SECTION, 'REJECTED refund signed by non-maintainer', undefined, reason.slice(0, 90));
  });

  it('12. a bond derived with a contributor-chosen maintainerPkh is ignored by discovery', async () => {
    // Same registry + hint format, but the contributor swapped in their own "maintainer" key.
    const evilConfig = testConfig(w, { maintainerPkh: attacker.pkhHex, registryAddress: config.registryAddress });
    const evil = await fundBond(chain, evilConfig, issue(12), w.contributor);
    toCleanUp.push(evil);
    record(SECTION, 'fund: bond #12 with attacker maintainerPkh', evil.fundingTxid);
    const found = await discoverBonds(chain, config, issue(12));
    expect(found).toHaveLength(0);
    // ...while the hint really is in the registry history (so it was considered and rejected):
    const hist = await chain.getHistory(config.registryAddress);
    expect(hist.some((h) => h.tx_hash === evil.fundingTxid)).toBe(true);
  });
});

describe('discovery + timeout', () => {
  it('5. discovery finds each bond from registryAddress history alone, with correct status', async () => {
    const s1 = await getBondStatus(chain, config, issue(1));
    expect(s1.status).toBe('refunded');
    expect(s1.bonds[0].fundingTxid).toBe(refundBond.fundingTxid);
    const s2 = await getBondStatus(chain, config, issue(2));
    expect(s2.status).toBe('forfeited');
    const s4 = await getBondStatus(chain, config, issue(4));
    expect(['bonded', 'reclaimable']).toContain(s4.status);
    expect(s4.bonds[0].fundingTxid).toBe(reclaimBond.fundingTxid);
    const s99 = await getBondStatus(chain, config, issue(99));
    expect(s99.status).toBe('unfunded');
  });

  it('4. reclaim after the (network-scaled) timelock, broadcast with NO private key', async () => {
    const required = requiredConfirmations(config.reclaimBlocks);
    const fundingTxid = reclaimBond.fundingTxid;
    const bondAddr = reclaimBond.bond.address;
    console.log(
      `timelock: ${config.reclaimBlocks} unit(s) = ${required} confirmations (~${lockMinutes(config.reclaimBlocks)} min)`,
    );
    const reached = await waitFor(
      'confirmations',
      async () => (await chain.confirmations(fundingTxid, bondAddr)) >= required,
      RECLAIM_WAIT_MS,
      20_000,
    );
    if (!reached) {
      console.warn(
        `SKIPPED: ${required} confirmations not reached within 40 min. Re-run later; bond #4 stays reclaimable.`,
      );
      record(SECTION, 'reclaim #4', undefined, 'SKIPPED: timelock not reached within 40 min');
      return;
    }
    // The node is the final judge: retry every 60 s up to 30 min while it still says non-BIP68-final.
    const deadline = Date.now() + 30 * 60 * 1000;
    let txid: string | undefined;
    for (let attempt = 1; ; attempt++) {
      const st = await getBondStatus(chain, config, issue(4));
      const conf = await chain.confirmations(fundingTxid, bondAddr);
      expect(st.status).toBe('reclaimable');
      // Note: no SignatureTemplate, no WIF: only public data.
      const hex = buildReclaimTx({ bond: reclaimBond.bond, utxo: st.bonds[0].utxo!, provider: await chain.provider() });
      try {
        txid = await chain.broadcast(hex);
        console.log(`attempt ${attempt}: accepted at ${conf} confirmations`);
        break;
      } catch (e) {
        if (!isTimelockNotReached(e) || Date.now() > deadline) throw e;
        console.log(`attempt ${attempt}: ${conf} confirmations, node says non-BIP68-final; retrying in 60 s`);
        await sleep(60_000);
      }
    }
    record(SECTION, 'reclaim #4 (permissionless, no key)', txid);
    const tx = (await chain.getTx(txid)).tx;
    expect(equalBytes(tx.outputs[0].lockingBytecode, encodeLockingBytecodeP2pkh(w.contributor.pkh))).toBe(true);
    expect(tx.outputs[0].valueSatoshis).toBeGreaterThanOrEqual(50_000n - BigInt(config.maxFeeSats));
    expect(tx.inputs[0].sequenceNumber).toBe(config.reclaimBlocks);
    const after = await waitFor(
      'reclaimed status',
      async () => (await getBondStatus(chain, config, issue(4))).status === 'reclaimed',
      60_000,
      3000,
    );
    expect(after).toBe(true);
  });
});
