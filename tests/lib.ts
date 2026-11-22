// Shared helpers for the real-chain e2e suite and demo seeding. Everything goes to the real network.
import { SignatureTemplate, type SpendableUtxo } from 'cashscript';
import { Chain, getNetwork, newKey, parseBondConfig, type BondConfig, type IssueRef, type KeyInfo } from '@bond/core';
import { buildFundingTx, type DerivedBond } from '@bond/contracts';
import { loadEnv, requireKey } from '../scripts/lib/env.js';

export interface Wallets {
  maintainer: KeyInfo;
  contributor: KeyInfo;
  charity: KeyInfo;
}

export function loadWallets(): Wallets {
  loadEnv();
  return {
    maintainer: requireKey('MAINTAINER_WIF'),
    contributor: requireKey('CONTRIBUTOR_WIF'),
    charity: requireKey('CHARITY_WIF'),
  };
}

/** Fresh registry address per test process: keeps each run's discovery scan small and isolated. */
const RUN_REGISTRY = newKey().address;

export function testConfig(w: Wallets, overrides: Partial<Record<string, unknown>> = {}): BondConfig {
  return parseBondConfig({
    version: 1,
    network: getNetwork().name,
    maintainerPkh: w.maintainer.pkhHex,
    charityAddress: w.charity.address,
    minValueSats: 50_000,
    reclaimBlocks: 1,
    maxFeeSats: 1500,
    registryAddress: RUN_REGISTRY,
    ...overrides,
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(
  what: string,
  fn: () => Promise<T | undefined | false>,
  timeoutMs: number,
  intervalMs = 5000,
): Promise<T | undefined> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    if (Date.now() > end) return undefined;
    await sleep(intervalMs);
  }
}

export interface FundedBond {
  bond: DerivedBond;
  fundingTxid: string;
  utxo: SpendableUtxo;
  issue: IssueRef;
}

/**
 * Fund a bond with the SAME builder the web app uses. The only difference: the web app passes
 * placeholder unlockers and the wallet signs; here the contributor's real key signs.
 */
export async function fundBond(
  chain: Chain,
  config: BondConfig,
  issue: IssueRef,
  contributor: KeyInfo,
  amountSats?: number,
): Promise<FundedBond> {
  const provider = await chain.provider();
  const utxos = await chain.getUtxos(contributor.address);
  const sig = new SignatureTemplate(contributor.privateKey);
  const plan = buildFundingTx({
    config,
    issue,
    contributorAddress: contributor.address,
    utxos,
    makeUnlocker: () => sig.unlockP2PKH(),
    provider,
    amountSats,
  });
  const hex = plan.builder.build();
  const txid = await chain.broadcast(hex);
  const utxo = await waitFor(
    'bond utxo',
    async () => (await chain.getUtxos(plan.bond.address)).find((u) => u.txid === txid && u.vout === 0),
    60_000,
    2000,
  );
  if (!utxo) throw new Error(`Bond UTXO ${txid}:0 not visible after broadcast`);
  return { bond: plan.bond, fundingTxid: txid, utxo, issue };
}

export function uniqueRepo(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}
