/**
 * WizardConnect wallet adapter for the funding transaction.
 *
 * The wallet shares one xpub per named path ("receive", "change") in wallet_ready. We derive
 * child pubkeys locally (manager.getPubkey), turn them into P2PKH addresses for the ACTIVE network,
 * ask Electrum for their UTXOs, build the tx with placeholder unlockers, and send it with
 * inputPaths = [inputIndex, pathName, addressIndex] so the wallet knows which key signs each input.
 */
import type { DappConnectionManager } from '@wizardconnect/dapp';
import { placeholderP2PKHUnlocker, type SpendableUtxo } from 'cashscript';
import { binToHex, getNetwork, hash160, pkhToAddress, type BondConfig, type IssueRef } from '@bond/core';
import { buildFundingTx, InsufficientFundsError, type DerivedBond } from '@bond/contracts';
import { getChain } from './chain';

const PATHS = [
  { name: 'receive', child: 0, scan: 20 },
  { name: 'change', child: 1, scan: 10 },
] as const;

export interface WalletUtxo extends SpendableUtxo {
  path: string;
  index: number;
  address: string;
}

export interface WalletView {
  /** Contributor identity = receive/0 (refunds and reclaims return here). */
  address: string;
  pkh: Uint8Array;
  utxos: WalletUtxo[];
  balance: bigint;
}

export class WalletError extends Error {
  constructor(
    message: string,
    public kind: 'rejected' | 'timeout' | 'network' | 'funds' | 'other',
  ) {
    super(message);
  }
}

export async function readWallet(manager: DappConnectionManager): Promise<WalletView> {
  if (!manager.hasPath(0))
    throw new WalletError('Wallet did not share a receive path (xpub). Reconnect and try again.', 'other');
  const chain = getChain();
  const utxos: WalletUtxo[] = [];
  let first: { address: string; pkh: Uint8Array } | undefined;
  for (const p of PATHS) {
    if (!manager.hasPath(p.child)) continue;
    const addrs: { address: string; index: number }[] = [];
    for (let i = 0; i < p.scan; i++) {
      const pk = manager.getPubkey(p.child, BigInt(i));
      if (!pk) break;
      const pkh = hash160(pk);
      const address = pkhToAddress(pkh);
      if (p.child === 0 && i === 0) first = { address, pkh };
      addrs.push({ address, index: i });
    }
    const results = await Promise.all(addrs.map((a) => chain.getUtxos(a.address).then((u) => ({ a, u }))));
    for (const { a, u } of results) {
      for (const x of u) if (!x.token) utxos.push({ ...x, path: p.name, index: a.index, address: a.address });
    }
  }
  if (!first) throw new WalletError('Could not derive the wallet receive address.', 'other');
  return { ...first, utxos, balance: utxos.reduce((s, u) => s + u.satoshis, 0n) };
}

/**
 * The relay sends JSON, which cannot carry BigInt or Uint8Array. WizardConnect's format is
 * `<bigint: 500n>` and `<Uint8Array: 0x...>` strings, which wallets parse back (see @wizardconnect/core serialize).
 */
function toRelayJson(value: unknown): unknown {
  if (typeof value === 'bigint') return `<bigint: ${value}n>`;
  if (value instanceof Uint8Array) return `<Uint8Array: 0x${binToHex(value)}>`;
  if (Array.isArray(value)) return value.map(toRelayJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toRelayJson(v)]));
  }
  return value;
}

export interface FundResult {
  txid: string;
  bond: DerivedBond;
  amountSats: bigint;
}

export async function fundWithWizardConnect(
  manager: DappConnectionManager,
  wallet: WalletView,
  config: BondConfig,
  issue: IssueRef,
  signal?: AbortSignal,
): Promise<FundResult> {
  const net = getNetwork();
  if (wallet.utxos.length === 0) {
    throw new WalletError(
      `No ${net.label.toLowerCase()} coins found in this wallet. Make sure the wallet is on ${net.name} and funded, then retry.`,
      'funds',
    );
  }
  const chain = getChain();
  const provider = await chain.provider();
  const byOutpoint = new Map(wallet.utxos.map((u) => [`${u.txid}:${u.vout}`, u]));
  let plan;
  try {
    plan = buildFundingTx({
      config,
      issue,
      contributorAddress: wallet.address,
      utxos: wallet.utxos,
      makeUnlocker: (u) => placeholderP2PKHUnlocker(byOutpoint.get(`${u.txid}:${u.vout}`)!.address),
      provider,
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      throw new WalletError(`Not enough funds: need ${e.needed} sats, wallet has ${e.available} sats.`, 'funds');
    }
    throw e;
  }
  const inputPaths: [number, string, number][] = plan.builder.inputs.map((inp, i) => {
    const u = byOutpoint.get(`${inp.txid}:${inp.vout}`)!;
    return [i, u.path, u.index];
  });
  const transaction = plan.builder.generateWcTransactionObject({
    broadcast: false,
    userPrompt: `Lock ${plan.amountSats} sats as a refundable Bond for ${issue.owner}/${issue.repo}#${issue.number}`,
  });

  let signedHex: string;
  try {
    const res = await manager.signTransaction(
      {
        transaction: toRelayJson(transaction) as unknown as Parameters<DappConnectionManager['signTransaction']>[0]['transaction'],
        inputPaths,
      },
      { signal },
    );
    if (res.error)
      throw new WalletError(
        `Wallet refused: ${res.error}`,
        /reject|denied|cancel/i.test(res.error) ? 'rejected' : 'other',
      );
    signedHex = res.signedTransaction;
  } catch (e) {
    if (e instanceof WalletError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if ((e as Error)?.name === 'AbortError') throw new WalletError('Signing cancelled.', 'rejected');
    if (/reject|denied|cancel/i.test(msg))
      throw new WalletError('You rejected the transaction in your wallet.', 'rejected');
    if (/timeout|timed out/i.test(msg))
      throw new WalletError('The wallet did not answer in time (relay timeout).', 'timeout');
    throw new WalletError(`Signing failed: ${msg}`, 'other');
  }

  // Sanity: the wallet must have signed OUR transaction (same outputs), not something else.
  const { decodeTransaction, hexToBin } = await import('@bitauth/libauth');
  const signed = decodeTransaction(hexToBin(signedHex));
  if (typeof signed === 'string') throw new WalletError(`Wallet returned an invalid transaction: ${signed}`, 'other');
  if (binToHex(signed.outputs[0].lockingBytecode) !== binToHex(plan.bond.lockingBytecode)) {
    throw new WalletError(
      'Wallet returned a transaction that does not pay the bond contract. Not broadcasting.',
      'other',
    );
  }

  const txid = await chain.broadcast(signedHex);
  return { txid, bond: plan.bond, amountSats: plan.amountSats };
}
