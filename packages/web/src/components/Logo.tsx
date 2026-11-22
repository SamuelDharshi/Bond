import { getNetwork } from '@bond/core';
import { href } from '../lib/router';

const ASPECT = 4.14; // width / height of the approved logo files

/** The approved Bond logo (light-background version), used as supplied. Height in px: ~32 in the nav, ~22 in the footer. */
export function Logo({ height = 32 }: { height?: number }) {
  const net = getNetwork();
  return (
    <a className="logo" href={href('/')}>
      <img
        src={`${import.meta.env.BASE_URL}brand/bond-logo-light.svg`}
        alt="bond"
        height={height}
        width={Math.round(height * ASPECT)}
      />
      <span className={`on ${net.isTestnet ? 'test' : ''}`}>on {net.name}</span>
    </a>
  );
}
