// Demo repo helpers: the demo repo slug and its bond.json (generated from .env keys).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getNetwork, parseBondConfig, type BondConfig, type IssueRef } from '@bond/core';
import { ROOT, loadEnv, requireKey } from './env.js';

export const DEMO_CONFIG_PATH = resolve(ROOT, 'demo-repo', '.github', 'bond.json');

export function demoRepo(): { owner: string; repo: string } {
  loadEnv();
  const slug = process.env.BOND_DEMO_REPO || process.env.VITE_DEMO_REPO || 'bond-demo/bond-demo';
  const [owner, repo] = slug.split('/');
  if (!owner || !repo) throw new Error(`BOND_DEMO_REPO must be owner/repo, got "${slug}"`);
  return { owner, repo };
}

export const demoIssue = (number: number): IssueRef => ({ ...demoRepo(), number });

/** (Re)write demo-repo/.github/bond.json from the keys in .env. Keeps labels/appUrl if present. */
export function writeDemoConfig(): BondConfig {
  const maintainer = requireKey('MAINTAINER_WIF');
  const charity = requireKey('CHARITY_WIF');
  const prev = existsSync(DEMO_CONFIG_PATH)
    ? (JSON.parse(readFileSync(DEMO_CONFIG_PATH, 'utf8')) as Record<string, unknown>)
    : {};
  const raw = {
    version: 1,
    network: getNetwork().name,
    maintainerPkh: maintainer.pkhHex,
    charityAddress: charity.address,
    registryAddress: maintainer.address,
    minValueSats: 50000,
    reclaimBlocks: 1,
    maxFeeSats: 1500,
    labels: prev.labels ?? { bonded: 'bonded ✓', valid: 'valid', slop: 'slop' },
    ...(process.env.BOND_APP_URL ? { appUrl: process.env.BOND_APP_URL } : prev.appUrl ? { appUrl: prev.appUrl } : {}),
  };
  const config = parseBondConfig(raw);
  writeFileSync(DEMO_CONFIG_PATH, JSON.stringify(raw, null, 2) + '\n');
  return config;
}

export function readDemoConfig(): BondConfig {
  return parseBondConfig(JSON.parse(readFileSync(DEMO_CONFIG_PATH, 'utf8')));
}
