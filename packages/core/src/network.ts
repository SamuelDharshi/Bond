/**
 * THE ONLY MODULE THAT KNOWS NETWORK NAMES.
 *
 * Switch networks with a single env var: BCH_NETWORK=chipnet|mainnet
 * (In the web app, Vite injects the same BCH_NETWORK at build time as __BCH_NETWORK__.)
 * Nothing else in the codebase may hard-code a network, prefix, server or explorer.
 */
export type NetworkName = 'chipnet' | 'mainnet';

export interface NetworkConfig {
  name: NetworkName;
  /** Value passed to CashScript's `Network` (it uses the same strings). */
  cashscriptNetwork: NetworkName;
  /** CashAddress prefix. */
  addressPrefix: 'bchtest' | 'bitcoincash';
  /** WIF encoding type for libauth. */
  wifType: 'testnet' | 'mainnet';
  /** WIF types accepted when importing keys (compressed + uncompressed). */
  acceptedWifTypes: string[];
  /** Electrum (Fulcrum) WSS hostnames, tried in order with automatic fallback. */
  electrumServers: string[];
  /** Block explorer links. */
  explorerTx: (txid: string) => string;
  explorerAddress: (address: string) => string;
  /**
   * How many blocks one unit of a BIP68 block-based relative lock (nSequence / this.age) takes.
   * Faster Blocks (CHIP-2025-03) keeps legacy locks on the old 10-minute scale, so on a
   * 1-minute-block chain a lock of N needs ~10*N blocks. Mainnet is 1 until Faster Blocks
   * activates there: UPDATE THIS (and avgBlockSeconds) when it does.
   */
  relativeLockBlocksPerUnit: number;
  /**
   * Extra confirmations added to the reclaimable threshold so the UI never says "ready" a block
   * before the node agrees (the node stays the final judge). Chipnet: 1, mainnet: 0.
   */
  relativeLockSafetyBlocks: number;
  /** Expected seconds between blocks, used only for "try again in ~X minutes" estimates. */
  avgBlockSeconds: number;
  /** Human label used in badges. */
  label: string;
  isTestnet: boolean;
}

const NETWORKS: Record<NetworkName, NetworkConfig> = {
  chipnet: {
    name: 'chipnet',
    cashscriptNetwork: 'chipnet',
    addressPrefix: 'bchtest',
    wifType: 'testnet',
    acceptedWifTypes: ['testnet', 'testnetUncompressed'],
    electrumServers: ['chipnet.bch.ninja', 'chipnet.imaginary.cash'],
    explorerTx: (txid) => `https://chipnet.imaginary.cash/tx/${txid}`,
    explorerAddress: (address) => `https://chipnet.imaginary.cash/address/${address}`,
    relativeLockBlocksPerUnit: 10,
    relativeLockSafetyBlocks: 1,
    avgBlockSeconds: 60,
    label: 'CHIPNET',
    isTestnet: true,
  },
  mainnet: {
    name: 'mainnet',
    cashscriptNetwork: 'mainnet',
    addressPrefix: 'bitcoincash',
    wifType: 'mainnet',
    acceptedWifTypes: ['mainnet', 'mainnetUncompressed'],
    electrumServers: ['bch.imaginary.cash', 'electroncash.de', 'bch.loping.net'],
    explorerTx: (txid) => `https://explorer.bch.ninja/tx/${txid}`,
    explorerAddress: (address) => `https://explorer.bch.ninja/address/${address}`,
    relativeLockBlocksPerUnit: 1,
    relativeLockSafetyBlocks: 0,
    avgBlockSeconds: 600,
    label: 'MAINNET',
    isTestnet: false,
  },
};

export const NETWORK_NAMES = Object.keys(NETWORKS) as NetworkName[];

/** The production network and the one offered as "Practice on testnet" in the web app. */
export const LIVE_NETWORK: NetworkName = 'mainnet';
export const PRACTICE_NETWORK: NetworkName = 'chipnet';

export function getNetworkConfig(name: NetworkName): NetworkConfig {
  return NETWORKS[name];
}

declare const __BCH_NETWORK__: string | undefined;
declare const __BCH_ELECTRUM_SERVERS__: string | undefined;

function readEnv(name: 'BCH_NETWORK' | 'BCH_ELECTRUM_SERVERS'): string | undefined {
  // Browser builds: Vite replaces these identifiers at build time.
  if (name === 'BCH_NETWORK' && typeof __BCH_NETWORK__ !== 'undefined' && __BCH_NETWORK__) return __BCH_NETWORK__;
  if (name === 'BCH_ELECTRUM_SERVERS' && typeof __BCH_ELECTRUM_SERVERS__ !== 'undefined' && __BCH_ELECTRUM_SERVERS__)
    return __BCH_ELECTRUM_SERVERS__;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name] || undefined;
}

export function isNetworkName(v: unknown): v is NetworkName {
  return typeof v === 'string' && (NETWORK_NAMES as string[]).includes(v);
}

let override: NetworkName | undefined;
let forced: NetworkName | undefined;

/** Browser only: a visitor's explicit choice (the "Practice on testnet" toggle). Beats every default. */
export function setRuntimeNetwork(name: NetworkName | undefined): void {
  forced = name;
}

/** Used only by the GitHub Action when BCH_NETWORK is unset: fall back to bond.json's network. */
export function setNetworkIfUnset(name: NetworkName): void {
  if (!readEnv('BCH_NETWORK')) override = name;
}

export function getNetwork(): NetworkConfig {
  const raw = forced ?? readEnv('BCH_NETWORK') ?? override ?? 'chipnet';
  if (!isNetworkName(raw)) throw new Error(`BCH_NETWORK must be one of ${NETWORK_NAMES.join('|')}, got "${raw}"`);
  const base = NETWORKS[raw];
  const servers = readEnv('BCH_ELECTRUM_SERVERS');
  return servers
    ? {
        ...base,
        electrumServers: servers
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }
    : base;
}
