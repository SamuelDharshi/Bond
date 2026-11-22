import { getNetwork } from '@bond/core';

/** A bond this browser created. Kept in localStorage only (the chain stays the source of truth for status). */
export interface MyBond {
  issueUrl: string;
  txid: string;
  amountSats: string;
  contractAddress: string;
  network: string;
  at: number;
}

const KEY = 'bond-history-v1';

export function loadMyBonds(): MyBond[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as MyBond[];
    return all.filter((b) => b.network === getNetwork().name).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export function saveMyBond(b: Omit<MyBond, 'network' | 'at'>): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as MyBond[];
    if (all.some((x) => x.txid === b.txid)) return;
    all.push({ ...b, network: getNetwork().name, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    /* storage blocked: the on-chain record is unaffected */
  }
}
