import { binToHex, equalBytes, utf8ToBin } from './bytes.js';

/**
 * Bond hint OP_RETURN (output[1] of a funding tx):
 *   OP_RETURN <push 57 bytes: "BOND" | 0x01 | subjectHash(32) | contributorPkh(20)>
 * Encoded as ONE data push so the payload is exactly 57 bytes:
 *   locking bytecode = 0x6a 0x39 <57 bytes>  (59 bytes total)
 */
export const HINT_MAGIC = utf8ToBin('BOND');
export const HINT_VERSION = 0x01;
export const HINT_PAYLOAD_LENGTH = 4 + 1 + 32 + 20;

export interface BondHint {
  version: number;
  subjectHash: Uint8Array;
  contributorPkh: Uint8Array;
}

export function encodeHintPayload(h: { subjectHash: Uint8Array; contributorPkh: Uint8Array }): Uint8Array {
  if (h.subjectHash.length !== 32) throw new Error('subjectHash must be 32 bytes');
  if (h.contributorPkh.length !== 20) throw new Error('contributorPkh must be 20 bytes');
  const out = new Uint8Array(HINT_PAYLOAD_LENGTH);
  out.set(HINT_MAGIC, 0);
  out[4] = HINT_VERSION;
  out.set(h.subjectHash, 5);
  out.set(h.contributorPkh, 37);
  return out;
}

export function encodeHintLockingBytecode(h: { subjectHash: Uint8Array; contributorPkh: Uint8Array }): Uint8Array {
  const payload = encodeHintPayload(h);
  const out = new Uint8Array(2 + payload.length);
  out[0] = 0x6a; // OP_RETURN
  out[1] = HINT_PAYLOAD_LENGTH; // direct push of 57 bytes
  out.set(payload, 2);
  return out;
}

export function decodeHintPayload(p: Uint8Array): BondHint | undefined {
  if (p.length !== HINT_PAYLOAD_LENGTH) return undefined;
  if (!equalBytes(p.slice(0, 4), HINT_MAGIC)) return undefined;
  if (p[4] !== HINT_VERSION) return undefined;
  return { version: p[4], subjectHash: p.slice(5, 37), contributorPkh: p.slice(37, 57) };
}

/** Accepts an output's locking bytecode; returns undefined unless it is a v1 Bond hint. */
export function decodeHintLockingBytecode(lb: Uint8Array): BondHint | undefined {
  if (lb.length !== 2 + HINT_PAYLOAD_LENGTH || lb[0] !== 0x6a || lb[1] !== HINT_PAYLOAD_LENGTH) return undefined;
  return decodeHintPayload(lb.slice(2));
}

export const hintToHex = (h: BondHint): { subjectHash: string; contributorPkh: string } => ({
  subjectHash: binToHex(h.subjectHash),
  contributorPkh: binToHex(h.contributorPkh),
});
