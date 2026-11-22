import {
  Contract,
  ElectrumNetworkProvider,
  SignatureTemplate,
  TransactionBuilder,
  type NetworkProvider,
  type SpendableUtxo,
  type Unlocker,
} from 'cashscript';
import {
  addressToLockingBytecode,
  addressToPkh,
  binToHex,
  encodeHintPayload,
  encodeLockingBytecodeP2pkh,
  getNetwork,
  hexToBin,
  subjectHash as computeSubjectHash,
  DUST_SATS,
  MAX_FEE_CEILING,
  type BondConfig,
  type IssueRef,
} from '@bond/core';
import artifact from './artifact/Bond.artifact.js';

export { artifact };
export type BondContract = Contract<typeof artifact>;

export interface BondParams {
  contributorPkh: Uint8Array;
  maintainerPkh: Uint8Array;
  charityLock: Uint8Array;
  reclaimBlocks: number;
  maxFee: number;
  subjectHash: Uint8Array;
}

export interface DerivedBond {
  contract: BondContract;
  address: string;
  tokenAddress: string;
  lockingBytecode: Uint8Array;
  params: BondParams;
}

/** Fee rate used for every Bond transaction (sats/byte). */
export const FEE_RATE = 1;

let defaultProvider: NetworkProvider | undefined;
/** A lazily-connecting provider; only used when the caller doesn't pass one (address derivation needs none). */
function lazyProvider(): NetworkProvider {
  if (!defaultProvider || defaultProvider.network !== getNetwork().cashscriptNetwork) {
    defaultProvider = new ElectrumNetworkProvider(getNetwork().cashscriptNetwork, {
      hostname: getNetwork().electrumServers[0],
    });
  }
  return defaultProvider;
}

export function bondParams(config: BondConfig, issue: IssueRef, contributorPkh: Uint8Array): BondParams {
  return {
    contributorPkh,
    maintainerPkh: hexToBin(config.maintainerPkh),
    charityLock: addressToLockingBytecode(config.charityAddress),
    reclaimBlocks: config.reclaimBlocks,
    maxFee: config.maxFeeSats,
    subjectHash: computeSubjectHash(issue),
  };
}

export function deriveBondFromParams(params: BondParams, provider: NetworkProvider = lazyProvider()): DerivedBond {
  if (params.contributorPkh.length !== 20) throw new Error('contributorPkh must be 20 bytes');
  if (params.maintainerPkh.length !== 20) throw new Error('maintainerPkh must be 20 bytes');
  if (params.subjectHash.length !== 32) throw new Error('subjectHash must be 32 bytes');
  if (params.maxFee > MAX_FEE_CEILING || params.maxFee < 0) throw new Error(`maxFee must be 0..${MAX_FEE_CEILING}`);
  if (params.reclaimBlocks < 1 || params.reclaimBlocks > 65535) throw new Error('reclaimBlocks must be 1..65535');
  const contract = new Contract(
    artifact,
    [
      params.contributorPkh,
      params.maintainerPkh,
      params.charityLock,
      BigInt(params.reclaimBlocks),
      BigInt(params.maxFee),
      params.subjectHash,
    ],
    { provider, contractType: 'p2sh32' },
  );
  return {
    contract,
    address: contract.address,
    tokenAddress: contract.tokenAddress,
    lockingBytecode: hexToBin(contract.lockingBytecode),
    params,
  };
}

/** deriveBond(config, issueRef, contributorPkh) -> { contract, address, tokenAddress, lockingBytecode, params } */
export function deriveBond(
  config: BondConfig,
  issue: IssueRef,
  contributorPkh: Uint8Array,
  provider?: NetworkProvider,
): DerivedBond {
  return deriveBondFromParams(bondParams(config, issue, contributorPkh), provider);
}

// ---------------------------------------------------------------- funding

export interface FundingInput {
  utxo: SpendableUtxo;
  /** SignatureTemplate.unlockP2PKH() for a local key, or placeholderP2PKHUnlocker(addr) for a wallet. */
  unlocker: Unlocker;
}

export interface BuildFundingArgs {
  config: BondConfig;
  issue: IssueRef;
  contributorAddress: string;
  /** Contributor's spendable BCH UTXOs (token UTXOs are ignored). */
  utxos: SpendableUtxo[];
  makeUnlocker: (utxo: SpendableUtxo) => Unlocker;
  provider: NetworkProvider;
  /** Defaults to config.minValueSats. */
  amountSats?: number;
}

export interface FundingPlan {
  builder: TransactionBuilder;
  bond: DerivedBond;
  amountSats: bigint;
  inputs: SpendableUtxo[];
}

export class InsufficientFundsError extends Error {
  constructor(
    public needed: bigint,
    public available: bigint,
  ) {
    super(`Insufficient funds: need ${needed} sats, wallet has ${available} sats`);
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Funding tx layout (protocol v1):
 *   out[0] bond amount -> Bond P2SH32
 *   out[1] OP_RETURN "BOND"|0x01|subjectHash|contributorPkh
 *   out[2] 546-sat ping -> registryAddress
 *   out[3] change -> contributor (if above dust)
 */
export function buildFundingTx(a: BuildFundingArgs): FundingPlan {
  const contributorPkh = addressToPkh(a.contributorAddress); // throws unless P2PKH on the active network
  const bond = deriveBond(a.config, a.issue, contributorPkh, a.provider);
  const amount = BigInt(a.amountSats ?? a.config.minValueSats);
  if (amount < BigInt(a.config.minValueSats)) throw new Error(`Bond must be at least ${a.config.minValueSats} sats`);

  const spendable = a.utxos.filter((u) => !u.token).sort((x, y) => Number(y.satoshis - x.satoshis));
  const available = spendable.reduce((s, u) => s + u.satoshis, 0n);
  const selected: SpendableUtxo[] = [];
  let total = 0n;
  // generous fee budget: 10 + 148/input + ~140 for outputs
  const need = (n: number) => amount + BigInt(DUST_SATS) + BigInt(200 + 150 * n);
  for (const u of spendable) {
    selected.push(u);
    total += u.satoshis;
    if (total >= need(selected.length)) break;
  }
  if (total < need(selected.length)) throw new InsufficientFundsError(need(Math.max(1, selected.length)), available);

  const builder = new TransactionBuilder({ provider: a.provider, maximumFeeSatoshis: 5000n });
  for (const u of selected) builder.addInput(u, a.makeUnlocker(u));
  builder.addOutput({ to: bond.lockingBytecode, amount });
  builder.addOpReturnOutput([
    '0x' + binToHex(encodeHintPayload({ subjectHash: bond.params.subjectHash, contributorPkh })),
  ]);
  builder.addOutput({ to: a.config.registryAddress, amount: BigInt(DUST_SATS) });
  builder.addBchChangeOutputIfNeeded({ to: a.contributorAddress, feeRate: FEE_RATE });
  return { builder, bond, amountSats: amount, inputs: selected };
}

// ---------------------------------------------------------------- spending

export interface SpendArgs {
  bond: DerivedBond;
  utxo: SpendableUtxo;
  provider: NetworkProvider;
  /** Override destination / fee for negative tests ONLY. The contract decides what is valid. */
  overrideTo?: string | Uint8Array;
  overrideFee?: bigint;
}

function spendTx(
  args: SpendArgs,
  unlocker: Unlocker,
  defaultTo: Uint8Array,
  sequence?: number,
): { builder: TransactionBuilder; fee: bigint } {
  const to = args.overrideTo ?? defaultTo;
  const make = (fee: bigint) =>
    new TransactionBuilder({ provider: args.provider })
      .addInput(args.utxo, unlocker, sequence === undefined ? undefined : { sequence })
      .addOutput({ to, amount: args.utxo.satoshis - fee });
  if (args.overrideFee !== undefined) return { builder: make(args.overrideFee), fee: args.overrideFee };
  // size the tx with a provisional fee, then pay exactly size * FEE_RATE (+2 bytes slack)
  const size = make(BigInt(args.bond.params.maxFee)).getTransactionSize();
  const fee = (size + 2n) * BigInt(FEE_RATE);
  if (fee > BigInt(args.bond.params.maxFee)) throw new Error(`Required fee ${fee} exceeds maxFee`);
  if (args.utxo.satoshis - fee < BigInt(DUST_SATS)) throw new Error('Bond too small to spend');
  return { builder: make(fee), fee };
}

const contributorLock = (b: DerivedBond) => encodeLockingBytecodeP2pkh(b.params.contributorPkh);

/** Maintainer refund: returns a signed raw tx hex paying the contributor. */
export function buildRefundTx(args: SpendArgs & { maintainerKey: SignatureTemplate }): string {
  const u = args.bond.contract.unlock.refund(args.maintainerKey.publicKey, args.maintainerKey);
  return spendTx(args, u, contributorLock(args.bond)).builder.build();
}

/** Maintainer forfeit: returns a signed raw tx hex paying the charity. */
export function buildForfeitTx(args: SpendArgs & { maintainerKey: SignatureTemplate }): string {
  const u = args.bond.contract.unlock.forfeit(args.maintainerKey.publicKey, args.maintainerKey);
  return spendTx(args, u, args.bond.params.charityLock).builder.build();
}

/**
 * Permissionless reclaim after the timeout. No key involved.
 * `this.age >= reclaimBlocks` compiles to OP_CHECKSEQUENCEVERIFY, so the input's nSequence must
 * encode a block-based relative lock >= reclaimBlocks (BIP68: bit31 clear, bit22 clear, low 16 bits).
 * TransactionBuilder defaults to 0xfffffffe, so we set sequence = reclaimBlocks explicitly
 * (tx version is 2, as BIP68 requires).
 */
export function buildReclaimTx(args: SpendArgs & { sequenceOverride?: number }): string {
  const u = args.bond.contract.unlock.reclaim();
  return spendTx(
    args,
    u,
    contributorLock(args.bond),
    args.sequenceOverride ?? args.bond.params.reclaimBlocks,
  ).builder.build();
}

/** Same as the builders above but returns the TransactionBuilder, for local VM evaluation (`.debug()`). */
export function spendBuilder(
  kind: 'refund' | 'forfeit' | 'reclaim',
  args: SpendArgs & { maintainerKey?: SignatureTemplate; sequenceOverride?: number },
): TransactionBuilder {
  if (kind === 'reclaim') {
    return spendTx(
      args,
      args.bond.contract.unlock.reclaim(),
      contributorLock(args.bond),
      args.sequenceOverride ?? args.bond.params.reclaimBlocks,
    ).builder;
  }
  const k = args.maintainerKey;
  if (!k) throw new Error('maintainerKey required');
  const u =
    kind === 'refund'
      ? args.bond.contract.unlock.refund(k.publicKey, k)
      : args.bond.contract.unlock.forfeit(k.publicKey, k);
  return spendTx(args, u, kind === 'refund' ? contributorLock(args.bond) : args.bond.params.charityLock).builder;
}

export async function broadcast(provider: NetworkProvider, hex: string): Promise<string> {
  return provider.sendRawTransaction(hex);
}
