import { getNetwork } from './network.js';

/** Confirmations before a bond is shown as reclaimable: lock units x blocks-per-unit, plus a safety margin. */
export const requiredConfirmations = (lockUnits: number): number =>
  lockUnits * getNetwork().relativeLockBlocksPerUnit + getNetwork().relativeLockSafetyBlocks;

export const blocksToMinutes = (blocks: number): number => Math.ceil((blocks * getNetwork().avgBlockSeconds) / 60);

/** Timeout shown to humans, in minutes. */
export const lockMinutes = (lockUnits: number): number => blocksToMinutes(requiredConfirmations(lockUnits));

/** True when the node rejected a spend because the relative timelock has not passed yet. */
export const isTimelockNotReached = (e: unknown): boolean =>
  /non-BIP68-final/i.test(e instanceof Error ? e.message : String(e));

/** Friendly message for a node rejection of reclaim(): never a crash, never a fake success. */
export function notYetMessage(confirmations: number, lockUnits: number): string {
  const remaining = Math.max(1, requiredConfirmations(lockUnits) - confirmations);
  return `Not yet: the network's timelock hasn't passed, try again in ~${blocksToMinutes(remaining)} minutes.`;
}
