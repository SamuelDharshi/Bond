import { ElectrumClient, type ElectrumClientEvents, type RequestResponse } from '@electrum-cash/network';
import { decodeTransaction, hexToBin, type TransactionCommon } from '@bitauth/libauth';
import { ElectrumNetworkProvider, type NetworkProvider } from 'cashscript';
import { getNetwork } from './network.js';

export interface HistoryItem {
  tx_hash: string;
  /** 0 or -1 for mempool. */
  height: number;
}

export interface DecodedTx {
  txid: string;
  hex: string;
  tx: TransactionCommon;
}

const CONNECT_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Error carrying the node's rejection message (e.g. "mandatory-script-verify-flag-failed"). */
export class BroadcastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BroadcastError';
  }
}

/**
 * Thin Electrum client over real Fulcrum servers with automatic fallback.
 * One instance holds one live connection; on a connection error it moves to the next server.
 */
export class Chain {
  private client?: ElectrumClient<ElectrumClientEvents>;
  private serverIndex = 0;
  private txCache = new Map<string, DecodedTx>();
  private _provider?: NetworkProvider;
  readonly servers: string[];
  connectedHost?: string;

  constructor(servers: string[] = getNetwork().electrumServers) {
    if (servers.length === 0) throw new Error('No Electrum servers configured');
    this.servers = servers;
  }

  async connect(): Promise<void> {
    if (this.client) return;
    const errors: string[] = [];
    for (let n = 0; n < this.servers.length; n++) {
      const idx = (this.serverIndex + n) % this.servers.length;
      const host = this.servers[idx];
      const c = new ElectrumClient('bond', '1.4.1', host);
      try {
        await withTimeout(c.connect(), CONNECT_TIMEOUT_MS, `connect ${host}`);
        this.client = c;
        this.serverIndex = idx;
        this.connectedHost = host;
        this._provider = undefined;
        return;
      } catch (e) {
        errors.push(`${host}: ${(e as Error).message}`);
        void c.disconnect(true).catch(() => undefined);
      }
    }
    throw new Error(`Could not reach any Electrum server (${errors.join('; ')})`);
  }

  async close(): Promise<void> {
    const c = this.client;
    this.client = undefined;
    this._provider = undefined;
    if (c) await withTimeout(c.disconnect(true), 3000, 'disconnect').catch(() => undefined);
  }

  private async rotate(): Promise<void> {
    await this.close();
    this.serverIndex = (this.serverIndex + 1) % this.servers.length;
    await this.connect();
  }

  /** Raw RPC with one fallback retry on connection-level failure. RPC errors are thrown as-is. */
  async request(method: string, ...params: (string | number | boolean)[]): Promise<RequestResponse> {
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.connect();
      let res: Error | RequestResponse;
      try {
        res = await withTimeout(this.client!.request(method, ...params), 30_000, method);
      } catch (e) {
        if (attempt === 0) {
          await this.rotate();
          continue;
        }
        throw e;
      }
      if (res instanceof Error) throw res;
      return res;
    }
    throw new Error('unreachable');
  }

  /** CashScript NetworkProvider sharing this connection. */
  async provider(): Promise<NetworkProvider> {
    await this.connect();
    if (!this._provider) {
      this._provider = new ElectrumNetworkProvider(getNetwork().cashscriptNetwork, {
        electrum: this.client!,
        manualConnectionManagement: true,
      });
    }
    return this._provider;
  }

  async getTipHeight(): Promise<number> {
    const r = (await this.request('blockchain.headers.get_tip')) as { height: number };
    return r.height;
  }

  async getHistory(address: string): Promise<HistoryItem[]> {
    return (await this.request('blockchain.address.get_history', address)) as unknown as HistoryItem[];
  }

  async getTx(txid: string): Promise<DecodedTx> {
    const cached = this.txCache.get(txid);
    if (cached) return cached;
    const hex = (await this.request('blockchain.transaction.get', txid, false)) as string;
    const tx = decodeTransaction(hexToBin(hex));
    if (typeof tx === 'string') throw new Error(`Cannot decode ${txid}: ${tx}`);
    const d = { txid, hex, tx };
    this.txCache.set(txid, d);
    return d;
  }

  async getUtxos(address: string) {
    return (await this.provider()).getUtxos(address);
  }

  async getBalance(address: string): Promise<bigint> {
    const utxos = await this.getUtxos(address);
    return utxos.reduce((a, u) => a + u.satoshis, 0n);
  }

  /** Broadcast; throws BroadcastError with the node's rejection reason. Returns the txid. */
  async broadcast(hex: string): Promise<string> {
    try {
      return (await this.request('blockchain.transaction.broadcast', hex)) as string;
    } catch (e) {
      throw new BroadcastError((e as Error).message);
    }
  }

  /** Confirmation count for a tx in an address's history (0 if mempool / unknown). */
  async confirmations(txid: string, address: string): Promise<number> {
    const [hist, tip] = await Promise.all([this.getHistory(address), this.getTipHeight()]);
    const h = hist.find((x) => x.tx_hash === txid);
    if (!h || h.height <= 0) return 0;
    return tip - h.height + 1;
  }
}
