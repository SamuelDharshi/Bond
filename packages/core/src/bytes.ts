import {
  binToHex,
  cashAddressToLockingBytecode,
  encodeLockingBytecodeP2pkh,
  hash160,
  hexToBin,
  lockingBytecodeToCashAddress,
  sha256,
  utf8ToBin,
} from '@bitauth/libauth';
import { getNetwork } from './network.js';

export { binToHex, hexToBin, hash160, utf8ToBin, encodeLockingBytecodeP2pkh };

export const sha256Bin = (b: Uint8Array): Uint8Array => sha256.hash(b);

export function isHex(s: string, bytes?: number): boolean {
  if (!/^([0-9a-f]{2})*$/i.test(s)) return false;
  return bytes === undefined || s.length === bytes * 2;
}

/** Locking bytecode for a cashaddr. Throws on invalid or wrong-network address. */
export function addressToLockingBytecode(address: string): Uint8Array {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === 'string') throw new Error(`Invalid cashaddr "${address}": ${r}`);
  const net = getNetwork();
  if (r.prefix !== net.addressPrefix) {
    throw new Error(`Address ${address} is not a ${net.addressPrefix}: address (active network: ${net.name})`);
  }
  return r.bytecode;
}

export function lockingBytecodeToAddress(bytecode: Uint8Array, tokenSupport = false): string | undefined {
  const r = lockingBytecodeToCashAddress({ bytecode, prefix: getNetwork().addressPrefix, tokenSupport });
  return typeof r === 'string' ? undefined : r.address;
}

export function pkhToAddress(pkh: Uint8Array, tokenSupport = false): string {
  const a = lockingBytecodeToAddress(encodeLockingBytecodeP2pkh(pkh), tokenSupport);
  if (!a) throw new Error('bad pkh');
  return a;
}

/** Returns the 20-byte pubkey hash of a P2PKH cashaddr. */
export function addressToPkh(address: string): Uint8Array {
  const lb = addressToLockingBytecode(address);
  // 76 a9 14 <20 bytes> 88 ac
  if (lb.length !== 25 || lb[0] !== 0x76 || lb[1] !== 0xa9 || lb[2] !== 0x14 || lb[23] !== 0x88 || lb[24] !== 0xac) {
    throw new Error(`Address ${address} is not P2PKH`);
  }
  return lb.slice(3, 23);
}

export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);
