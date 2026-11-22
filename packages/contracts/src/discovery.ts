import { decodeAuthenticationInstructions, type TransactionCommon } from '@bitauth/libauth';
import type { NetworkProvider, SpendableUtxo } from 'cashscript';
import {
  binToHex,
  decodeHintLockingBytecode,
  encodeLockingBytecodeP2pkh,
  equalBytes,
  requiredConfirmations,
  subjectHash as computeSubjectHash,
  type BondConfig,
  type Chain,
  type IssueRef,
} from '@bond/core';
import { bondParams, deriveBondFromParams, type DerivedBond } from './bond.js';

export type BondStatus = 'unfunded' | 'bonded' | 'refunded' | 'forfeited' | 'reclaimed' | 'reclaimable';

export interface DiscoveredBond {
  bond: DerivedBond;
  contributorPkh: string;
  subjectHash: string;
  fundingTxid: string;
  /** Always 0 in protocol v1. */
  vout: number;
  valueSats: bigint;
  /** Block height of the funding tx; 0 = mempool. */
  fundingHeight: number;
  confirmations: number;
  status: Exclude<BondStatus, 'unfunded'>;
  spendTxid?: string;
  /** Present while unspent. */
  utxo?: SpendableUtxo;
}

/** A hint found in a tx in the registry address history. Pointer only, never proof. */
interface HintRef {
  txid: string;
  height: number;
  tx: TransactionCommon;
  subjectHash: Uint8Array;
  contributorPkh: Uint8Array;
}

async function scanRegistry(chain: Chain, config: BondConfig): Promise<HintRef[]> {
  const history = await chain.getHistory(config.registryAddress);
  const out: HintRef[] = [];
  // fetch sequentially in small batches to be polite to public servers
  for (let i = 0; i < history.length; i += 8) {
    const batch = history.slice(i, i + 8);
    const txs = await Promise.all(batch.map((h) => chain.getTx(h.tx_hash)));
    txs.forEach((d, j) => {
      const op = d.tx.outputs[1];
      if (!op) return;
      const hint = decodeHintLockingBytecode(op.lockingBytecode);
      if (!hint) return;
      out.push({
        txid: d.txid,
        height: batch[j].height,
        tx: d.tx,
        subjectHash: hint.subjectHash,
        contributorPkh: hint.contributorPkh,
      });
    });
  }
  return out;
}

/** Which function spent the bond: decoded from the selector pushed just before the redeem script. */
function spendKind(unlockingBytecode: Uint8Array): 'refund' | 'forfeit' | 'reclaim' | undefined {
  const ins = decodeAuthenticationInstructions(unlockingBytecode);
  const sel = ins[ins.length - 2];
  if (!sel) return undefined;
  if (sel.opcode === 0x00) return 'refund';
  if (sel.opcode === 0x51) return 'forfeit';
  if (sel.opcode === 0x52) return 'reclaim';
  return undefined;
}

async function resolveStatus(
  chain: Chain,
  bond: DerivedBond,
  fundingTxid: string,
  fundingHeight: number,
  tip: number,
): Promise<Pick<DiscoveredBond, 'status' | 'spendTxid' | 'utxo' | 'confirmations' | 'fundingHeight'>> {
  const history = await chain.getHistory(bond.address);
  const fh = history.find((h) => h.tx_hash === fundingTxid)?.height ?? fundingHeight;
  const confirmations = fh > 0 ? tip - fh + 1 : 0;
  for (const h of history) {
    if (h.tx_hash === fundingTxid) continue;
    const d = await chain.getTx(h.tx_hash);
    const idx = d.tx.inputs.findIndex(
      (inp) => binToHex(inp.outpointTransactionHash) === fundingTxid && inp.outpointIndex === 0,
    );
    if (idx < 0) continue;
    const out = d.tx.outputs[idx];
    const kind = spendKind(d.tx.inputs[idx].unlockingBytecode);
    const toContributor =
      !!out && equalBytes(out.lockingBytecode, encodeLockingBytecodeP2pkh(bond.params.contributorPkh));
    const toCharity = !!out && equalBytes(out.lockingBytecode, bond.params.charityLock);
    // Destination is what the contract enforced; selector tells refund from reclaim.
    const status = toCharity
      ? 'forfeited'
      : toContributor
        ? kind === 'reclaim'
          ? 'reclaimed'
          : 'refunded'
        : 'refunded';
    return { status, spendTxid: d.txid, confirmations, fundingHeight: fh };
  }
  const utxos = await chain.getUtxos(bond.address);
  const utxo = utxos.find((u) => u.txid === fundingTxid && u.vout === 0);
  if (!utxo) {
    // Spent but the spender isn't in history yet (indexer lag) — treat as still bonded; callers re-check before spending.
    return { status: 'bonded', confirmations, fundingHeight: fh };
  }
  const status = confirmations >= requiredConfirmations(bond.params.reclaimBlocks) ? 'reclaimable' : 'bonded';
  return { status, utxo, confirmations, fundingHeight: fh };
}

/**
 * Discover every bond for `issue` using ONLY Electrum calls:
 * registry history -> OP_RETURN hints -> re-derive contract from bond.json + hint ->
 * require output[0] bytecode == derived bytecode and value >= minValueSats -> spend status.
 */
export async function discoverBonds(chain: Chain, config: BondConfig, issue: IssueRef): Promise<DiscoveredBond[]> {
  const all = await discoverAllBonds(chain, config, [issue]);
  return all.get(binToHex(computeSubjectHash(issue))) ?? [];
}

/** Batch variant for scheduled runs: one registry scan, many issues. Keyed by subjectHash hex. */
export async function discoverAllBonds(
  chain: Chain,
  config: BondConfig,
  issues: IssueRef[],
): Promise<Map<string, DiscoveredBond[]>> {
  const wanted = new Map(issues.map((i) => [binToHex(computeSubjectHash(i)), i]));
  const hints = await scanRegistry(chain, config);
  const tip = await chain.getTipHeight();
  const result = new Map<string, DiscoveredBond[]>();
  const seen = new Set<string>();
  const provider: NetworkProvider = await chain.provider();
  for (const h of hints) {
    const sh = binToHex(h.subjectHash);
    const issue = wanted.get(sh);
    if (!issue || seen.has(h.txid)) continue;
    seen.add(h.txid);
    // Re-derive from the REPO'S config + the hinted contributor. A contributor-chosen maintainerPkh,
    // charity or timeout yields a different address and is ignored here.
    const params = bondParams(config, issue, h.contributorPkh);
    const bond = deriveBondFromParams(params, provider);
    const out0 = h.tx.outputs[0];
    if (!out0 || !equalBytes(out0.lockingBytecode, bond.lockingBytecode)) continue;
    if (out0.valueSatoshis < BigInt(config.minValueSats)) continue;
    const st = await resolveStatus(chain, bond, h.txid, h.height, tip);
    const list = result.get(sh) ?? [];
    list.push({
      bond,
      contributorPkh: binToHex(h.contributorPkh),
      subjectHash: sh,
      fundingTxid: h.txid,
      vout: 0,
      valueSats: out0.valueSatoshis,
      ...st,
    });
    result.set(sh, list);
  }
  return result;
}

const PRIORITY: BondStatus[] = ['reclaimable', 'bonded', 'refunded', 'forfeited', 'reclaimed', 'unfunded'];

/** Overall status of an issue: the "most live" of its bonds. */
export function summarizeStatus(bonds: DiscoveredBond[]): BondStatus {
  if (bonds.length === 0) return 'unfunded';
  return bonds.map((b) => b.status).sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0];
}

/** getBondStatus(...) -> "unfunded" | "bonded" | "refunded" | "forfeited" | "reclaimed" | "reclaimable" */
export async function getBondStatus(
  chain: Chain,
  config: BondConfig,
  issue: IssueRef,
): Promise<{ status: BondStatus; bonds: DiscoveredBond[] }> {
  const bonds = await discoverBonds(chain, config, issue);
  return { status: summarizeStatus(bonds), bonds };
}
