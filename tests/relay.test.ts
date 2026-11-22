// The wallet-signing request must survive JSON (the WizardConnect relay) and parse back to the same native values.
import { describe, expect, it } from 'vitest';
import { MockNetworkProvider, placeholderP2PKHUnlocker } from 'cashscript';
import { newKey, parseBondConfig, getNetwork } from '@bond/core';
import { buildFundingTx } from '@bond/contracts';
import { toRelayJson } from '../packages/web/src/lib/relayJson';

const sdk = await import('../packages/web/node_modules/@wizardconnect/core/dist/index.js');

describe('WizardConnect signing request', () => {
  const maintainer = newKey();
  const contributor = newKey();
  const config = parseBondConfig({
    version: 1,
    network: getNetwork().name,
    maintainerPkh: maintainer.pkhHex,
    charityAddress: newKey().address,
    minValueSats: 50_000,
    reclaimBlocks: 144,
    maxFeeSats: 1500,
  });
  const utxo = {
    txid: 'ab'.repeat(32),
    vout: 0,
    satoshis: 200_000n,
    lockingBytecode: `76a914${contributor.pkhHex}88ac`,
  };
  const plan = buildFundingTx({
    config,
    issue: { owner: 'o', repo: 'r', number: 3 },
    contributorAddress: contributor.address,
    utxos: [utxo],
    makeUnlocker: () => placeholderP2PKHUnlocker(contributor.address),
    provider: new MockNetworkProvider(),
  });
  const wc = plan.builder.generateWcTransactionObject({ broadcast: false, userPrompt: 'test' });

  it('raw object fails JSON.stringify (the original bug)', () => {
    expect(() => JSON.stringify(wc)).toThrow(/BigInt/);
  });

  it('encoded object stringifies and parses back to the same native values', () => {
    const json = JSON.stringify(toRelayJson(wc));
    const back = sdk.parseExtendedJson(json) as typeof wc;
    expect(back.transaction.outputs.length).toBe(wc.transaction.outputs.length);
    wc.transaction.outputs.forEach((o, i) => {
      expect(back.transaction.outputs[i].valueSatoshis).toBe(o.valueSatoshis);
      expect(Buffer.from(back.transaction.outputs[i].lockingBytecode as Uint8Array).toString('hex')).toBe(
        Buffer.from(o.lockingBytecode as Uint8Array).toString('hex'),
      );
    });
    expect(back.sourceOutputs[0].valueSatoshis).toBe(wc.sourceOutputs[0].valueSatoshis);
  });
});
