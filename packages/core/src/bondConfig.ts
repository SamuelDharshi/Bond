import { z } from 'zod';
import { addressToLockingBytecode, addressToPkh, binToHex, hexToBin, isHex, pkhToAddress } from './bytes.js';
import { getNetwork, isNetworkName, type NetworkName } from './network.js';

/** Hard protocol ceiling: a spender can never take more than this as fee. */
export const MAX_FEE_CEILING = 2000;
export const DEFAULT_MAX_FEE = 1500;
/** Production default: ~14 days. BIP68 block-based relative locks max out at 65535. */
export const DEFAULT_RECLAIM_BLOCKS = 2016;
export const DUST_SATS = 546;

const cashaddr = z.string().refine(
  (s) => {
    try {
      addressToLockingBytecode(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'must be a valid cashaddr for the active network' },
);

export const bondConfigSchema = z.object({
  version: z.literal(1),
  network: z.string().refine(isNetworkName, { message: 'unknown network' }),
  maintainerPkh: z
    .string()
    .refine((s) => isHex(s, 20), { message: 'maintainerPkh must be 20 bytes of hex' })
    .transform((s) => s.toLowerCase()),
  charityAddress: cashaddr,
  registryAddress: cashaddr.optional(),
  minValueSats: z.number().int().min(10_000).max(100_000_000),
  reclaimBlocks: z.number().int().min(1).max(65_535).default(DEFAULT_RECLAIM_BLOCKS),
  maxFeeSats: z.number().int().min(300).max(MAX_FEE_CEILING).default(DEFAULT_MAX_FEE),
  labels: z
    .object({
      bonded: z.string().min(1).default('bonded ✓'),
      valid: z.string().min(1).default('valid'),
      slop: z.string().min(1).default('slop'),
    })
    .default({ bonded: 'bonded ✓', valid: 'valid', slop: 'slop' }),
  /** Optional: where the web app lives, used in Action comments. */
  appUrl: z.string().url().optional(),
});

export type BondConfigInput = z.input<typeof bondConfigSchema>;

export interface BondConfig {
  version: 1;
  network: NetworkName;
  maintainerPkh: string;
  charityAddress: string;
  /** Always resolved: defaults to the maintainer's P2PKH address. */
  registryAddress: string;
  minValueSats: number;
  reclaimBlocks: number;
  maxFeeSats: number;
  labels: { bonded: string; valid: string; slop: string };
  appUrl?: string;
}

/**
 * Parse + validate a bond.json object. Also checks that its network matches the active
 * BCH_NETWORK so a chipnet config can never be used against mainnet (or vice versa).
 */
export function parseBondConfig(raw: unknown): BondConfig {
  const parsed = bondConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`Invalid bond.json: ${msg}`);
  }
  const c = parsed.data;
  const active = getNetwork().name;
  if (c.network !== active)
    throw new Error(`bond.json network "${c.network}" does not match active network "${active}"`);
  const charityLock = addressToLockingBytecode(c.charityAddress);
  const registryAddress = c.registryAddress ?? maintainerAddress(c.maintainerPkh);
  // Sanity: registry must be a P2PKH or P2SH address on this network (already validated above).
  addressToLockingBytecode(registryAddress);
  if (binToHex(charityLock) === binToHex(addressToLockingBytecode(maintainerAddress(c.maintainerPkh)))) {
    throw new Error('Invalid bond.json: charityAddress must not be the maintainer address');
  }
  return {
    version: 1,
    network: c.network as NetworkName,
    maintainerPkh: c.maintainerPkh,
    charityAddress: c.charityAddress,
    registryAddress,
    minValueSats: c.minValueSats,
    reclaimBlocks: c.reclaimBlocks,
    maxFeeSats: c.maxFeeSats,
    labels: c.labels,
    appUrl: c.appUrl,
  };
}

function maintainerAddress(pkhHex: string): string {
  return pkhToAddress(hexToBin(pkhHex));
}

export { addressToPkh };
