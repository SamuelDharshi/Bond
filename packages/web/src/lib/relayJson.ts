import { binToHex } from '@bond/core';

/**
 * The relay sends JSON, which cannot carry BigInt or Uint8Array. WizardConnect's format is
 * `<bigint: 500n>` and `<Uint8Array: 0x...>` strings, which wallets parse back (see @wizardconnect/core serialize).
 */
export function toRelayJson(value: unknown): unknown {
  if (typeof value === 'bigint') return `<bigint: ${value}n>`;
  if (value instanceof Uint8Array) return `<Uint8Array: 0x${binToHex(value)}>`;
  if (Array.isArray(value)) return value.map(toRelayJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toRelayJson(v)]));
  }
  return value;
}
