import demoConfigRaw from '@demo-config';
import { parseBondConfig, type BondConfig, type IssueRef } from '@bond/core';
import { isDemoRepo } from './demoRepo';

export { DEMO_ISSUE_URL, DEMO_REPO, isDemoRepo } from './demoRepo';

export interface LoadedConfig {
  config: BondConfig;
  source: 'github' | 'bundled-demo';
  url: string;
}

const cache = new Map<string, Promise<LoadedConfig>>();

/**
 * Fetch .github/bond.json from the repo (HEAD). For the demo repo, fall back to the copy
 * bundled at build time so the demo works even before/without the GitHub repo.
 */
export function loadRepoConfig(ref: IssueRef): Promise<LoadedConfig> {
  const key = `${ref.owner}/${ref.repo}`.toLowerCase();
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD/.github/bond.json`;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return { config: parseBondConfig(await res.json()), source: 'github' as const, url };
        if (!isDemoRepo(ref))
          throw new Error(`This repo has no .github/bond.json (HTTP ${res.status}). It doesn't use Bond yet.`);
      } catch (e) {
        if (!isDemoRepo(ref)) throw e;
      }
      return { config: parseBondConfig(demoConfigRaw), source: 'bundled-demo' as const, url };
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}
