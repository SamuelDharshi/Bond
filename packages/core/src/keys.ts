import { decodePrivateKeyWif, encodePrivateKeyWif, generatePrivateKey, hash160, secp256k1 } from '@bitauth/libauth';
import { binToHex, pkhToAddress } from './bytes.js';
import { getNetwork } from './network.js';

export interface KeyInfo {
  wif: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  pkh: Uint8Array;
  pkhHex: string;
  address: string;
  tokenAddress: string;
}

export function keyFromPrivateKey(privateKey: Uint8Array): KeyInfo {
  const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
  if (typeof publicKey === 'string') throw new Error(publicKey);
  const pkh = hash160(publicKey);
  return {
    wif: encodePrivateKeyWif(privateKey, getNetwork().wifType),
    privateKey,
    publicKey,
    pkh,
    pkhHex: binToHex(pkh),
    address: pkhToAddress(pkh),
    tokenAddress: pkhToAddress(pkh, true),
  };
}

export function keyFromWif(wif: string): KeyInfo {
  const d = decodePrivateKeyWif(wif.trim());
  if (typeof d === 'string') throw new Error(`Invalid WIF: ${d}`);
  if (!getNetwork().acceptedWifTypes.includes(d.type)) {
    throw new Error(`WIF is for "${d.type}" but active network expects "${getNetwork().wifType}"`);
  }
  return keyFromPrivateKey(d.privateKey);
}

export function newKey(): KeyInfo {
  return keyFromPrivateKey(generatePrivateKey());
}
