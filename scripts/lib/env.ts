import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { keyFromWif, type KeyInfo } from '@bond/core';

export const ROOT = resolve(import.meta.dirname, '..', '..');
export const ENV_PATH = resolve(ROOT, '.env');

/** Load .env into process.env (does not override variables already set in the shell). */
export function loadEnv(): void {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined || process.env[m[1]] === '') process.env[m[1]] = v;
  }
}

/** Set KEY=value in .env, keeping every other line. Never overwrites a non-empty value unless force. */
export function setEnvVar(key: string, value: string, force = false): boolean {
  const text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    const cur = lines[idx].slice(key.length + 1).trim();
    if (cur && !force) return false;
    lines[idx] = `${key}=${value}`;
  } else {
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(`${key}=${value}`, '');
  }
  writeFileSync(ENV_PATH, lines.join('\n'));
  process.env[key] = value;
  return true;
}

export function requireKey(name: 'MAINTAINER_WIF' | 'CONTRIBUTOR_WIF' | 'CHARITY_WIF'): KeyInfo {
  loadEnv();
  const wif = process.env[name];
  if (!wif) throw new Error(`${name} missing in .env — run \`pnpm wallets:new\` first`);
  return keyFromWif(wif);
}

export function optionalKey(name: string): KeyInfo | undefined {
  loadEnv();
  const wif = process.env[name];
  return wif ? keyFromWif(wif) : undefined;
}
