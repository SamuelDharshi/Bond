import { href } from '../lib/router';

const ASPECT = 4.14; // width / height of the approved logo files

/** The approved Bond logo (light-background version), used as supplied. Height in px: ~32 in the nav, ~22 in the footer. */
export function Logo({ height = 32 }: { height?: number }) {
  return (
    <a className="logo" href={href('/')}>
      <img
        src={`${import.meta.env.BASE_URL}brand/bond-logo-light.svg`}
        alt="bond"
        height={height}
        width={Math.round(height * ASPECT)}
      />
    </a>
  );
}
