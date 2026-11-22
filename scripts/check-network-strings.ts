// pnpm check:network — proves network names/prefixes/servers live ONLY in packages/core/src/network.ts.
// Scans all source code (not docs, config data, lockfiles or generated bundles).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './lib/env.js';

const PATTERN =
  /chipnet|mainnet|testnet|bchtest:|bitcoincash:|imaginary\.cash|bch\.ninja|electroncash\.de|loping\.net/i;
const ALLOWED = new Set([
  'packages/core/src/network.ts',
  'scripts/check-network-strings.ts',
  'tests/unit.test.ts', // feeds explicit network names to the config parser on purpose
  'scripts/mainnet-proof.ts', // spends real BCH, so it is mainnet-only by design and refuses anything else
  'packages/web/src/lib/links.ts', // the project's public EMBER2026 donation address (a fixed mainnet address)
]);
const DIRS = [
  'packages/core/src',
  'packages/contracts/src',
  'packages/action/src',
  'packages/web/src',
  'scripts',
  'tests',
];
const EXT = /\.(ts|tsx|mts|js|mjs)$/;

const hits: string[] = [];
function walk(dir: string): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist' && name !== 'artifact') walk(p);
      continue;
    }
    const rel = relative(ROOT, p).replace(/\\/g, '/');
    if (!EXT.test(name) || ALLOWED.has(rel)) continue;
    readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const code = line
          .replace(/\/\*.*?\*\//g, '')
          .replace(/\/\/.*$/, '')
          .replace(/^\s*\*.*$/, '')
          .replace(/\bisTestnet\b/g, '')
          .replace(/Mainnet Track|Practice on testnet/g, '');
        if (PATTERN.test(code)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
  }
}
for (const d of DIRS) walk(join(ROOT, d));

if (hits.length) {
  console.error(`Network strings found outside packages/core/src/network.ts:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(
  `OK: no network names, prefixes, servers or explorers outside packages/core/src/network.ts (${DIRS.join(', ')})`,
);
