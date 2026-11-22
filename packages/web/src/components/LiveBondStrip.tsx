import { useEffect, useState } from 'react';
import { getNetwork, hexToBin } from '@bond/core';
import { DEMO_REPO } from '../lib/demoRepo';
import { sats } from './ui';

interface Latest {
  status: string;
  valueSats: bigint;
  at?: number; // unix seconds; undefined = still in the mempool
  txid: string;
}

const REFRESH_MS = 30_000;
const SCAN_ISSUES = 24;

async function readLatest(): Promise<Latest | undefined> {
  const [{ discoverAllBonds }, { getChain }, { loadRepoConfig }] = await Promise.all([
    import('@bond/contracts'),
    import('../lib/chain'),
    import('../lib/config'),
  ]);
  const owner = DEMO_REPO[0];
  const repo = DEMO_REPO[1];
  const cfg = await loadRepoConfig({ owner, repo, number: 1 });
  const chain = getChain();
  const issues = Array.from({ length: SCAN_ISSUES }, (_, i) => ({ owner, repo, number: i + 1 }));
  const found = [...(await discoverAllBonds(chain, cfg.config, issues)).values()].flat();
  if (found.length === 0) return undefined;
  // newest first: the mempool (height 0) is the newest of all
  found.sort((a, b) => (b.fundingHeight || Infinity) - (a.fundingHeight || Infinity));
  const b = found[0];
  let at: number | undefined;
  if (b.fundingHeight > 0) {
    const header = (await chain.request('blockchain.block.header', b.fundingHeight)) as unknown as string;
    const bytes = hexToBin(header);
    at = (bytes[68] | (bytes[69] << 8) | (bytes[70] << 16) | (bytes[71] << 24)) >>> 0;
  }
  return { status: b.status, valueSats: b.valueSats, at, txid: b.fundingTxid };
}

function ago(at: number | undefined): string {
  if (at === undefined) return 'just now';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - at);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129_600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

/** One quiet line under the hero scene. Any failure or empty result renders nothing at all. */
export function LiveBondStrip() {
  const [latest, setLatest] = useState<Latest>();
  useEffect(() => {
    let alive = true;
    const load = () => {
      readLatest().then(
        (l) => alive && setLatest(l),
        () => alive && setLatest(undefined),
      );
    };
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  if (!latest) return null;
  const net = getNetwork();
  return (
    <p className="live-strip">
      Latest on {net.name}: <strong>{latest.status}</strong> · {sats(latest.valueSats)} · {ago(latest.at)} ·{' '}
      <a href={net.explorerTx(latest.txid)} target="_blank" rel="noreferrer">
        {latest.txid.slice(0, 8)}…{latest.txid.slice(-4)}
      </a>
    </p>
  );
}
