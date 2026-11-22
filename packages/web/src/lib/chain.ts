import { Chain } from '@bond/core';

let chain: Chain | undefined;

/** One shared Electrum connection for the whole app (with server fallback inside Chain). */
export function getChain(): Chain {
  chain ??= new Chain();
  return chain;
}

/** Turn any error into a short human message. Never shows CashScript debug URIs (they can embed keys). */
export function humanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw
    .split('\n')[0]
    .replace(/https?:\/\/ide\.bitauth\.com\S*/g, '')
    .trim();
  if (/does not match active network/i.test(m))
    return 'This repository is set up for a different network. Use the switch in the footer to change network.';
  if (/Could not reach any Electrum server|timed out/i.test(m))
    return `Network problem: ${m}. Check your connection and retry.`;
  if (/non-BIP68-final/i.test(m)) return 'The timeout has not passed yet (the funding tx needs more confirmations).';
  if (/missing inputs|txn-mempool-conflict|already/i.test(m))
    return 'This bond was already spent (someone got there first). Refresh the status.';
  if (/mandatory-script-verify|script/i.test(m)) return `The contract rejected this transaction: ${m}`;
  return m.slice(0, 300);
}
