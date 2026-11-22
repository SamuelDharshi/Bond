import proofRaw from '@proof-txids';
import { getNetwork } from '@bond/core';

interface Entry {
  label: string;
  txid?: string;
  note?: string;
  network: string;
}

export interface Proof {
  label: string;
  txid: string;
}

/** Real transactions recorded by the e2e suite / seed script for the ACTIVE network. */
export function proofTxids(): Proof[] {
  const log = proofRaw as Record<string, Entry[]>;
  const net = getNetwork().name;
  const out: Proof[] = [];
  for (const entries of Object.values(log)) {
    for (const e of entries) {
      if (e.network === net && e.txid && !/^cleanup/i.test(e.label)) out.push({ label: e.label, txid: e.txid });
    }
  }
  return out.slice(0, 10);
}
