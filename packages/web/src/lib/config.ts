import { parseBondConfig, type BondConfig, type IssueRef } from '@bond/core';

export interface LoadedConfig {
  config: BondConfig;
  source: 'github';
  url: string;
}

const cache = new Map<string, Promise<LoadedConfig>>();

/** Fetch .github/bond.json from the repo (HEAD). A repo without one does not use Bond. */
export function loadRepoConfig(ref: IssueRef): Promise<LoadedConfig> {
  const key = `${ref.owner}/${ref.repo}`.toLowerCase();
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD/.github/bond.json`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`This repo has no .github/bond.json (HTTP ${res.status}). It doesn't use Bond yet.`);
      return { config: parseBondConfig(await res.json()), source: 'github' as const, url };
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}
