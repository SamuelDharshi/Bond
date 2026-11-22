import { useCallback, useEffect, useState } from 'react';
import type { IssueRef } from '@bond/core';
import { getBondStatus, type BondStatus, type DiscoveredBond } from '@bond/contracts';
import { getChain, humanError } from './chain';
import { loadRepoConfig, type LoadedConfig } from './config';

export interface IssueState {
  loading: boolean;
  error?: string;
  cfg?: LoadedConfig;
  status?: BondStatus;
  bonds: DiscoveredBond[];
  tip?: number;
  refresh: () => void;
}

/** Loads bond.json and live on-chain status for an issue (no backend, Electrum only). */
export function useIssue(ref: IssueRef | undefined, withStatus = true): IssueState {
  const [s, setS] = useState<Omit<IssueState, 'refresh'>>({ loading: false, bonds: [] });
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((x) => x + 1), []);
  const key = ref ? `${ref.owner}/${ref.repo}#${ref.number}` : '';
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    setS((p) => ({ ...p, loading: true, error: undefined }));
    (async () => {
      const cfg = await loadRepoConfig(ref);
      if (!alive) return;
      setS((p) => ({ ...p, cfg }));
      if (!withStatus) return setS((p) => ({ ...p, loading: false }));
      const chain = getChain();
      const [{ status, bonds }, tip] = await Promise.all([getBondStatus(chain, cfg.config, ref), chain.getTipHeight()]);
      if (alive) setS({ loading: false, cfg, status, bonds, tip });
    })().catch((e) => alive && setS((p) => ({ ...p, loading: false, error: humanError(e) })));
    return () => {
      alive = false;
    };
  }, [key, n, withStatus]);
  return { ...s, refresh };
}
