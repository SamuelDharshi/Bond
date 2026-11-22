import { getNetwork } from '@bond/core';
import { useBchUsd } from '../lib/price';

/** 0.0005 BCH on every network; the approximate USD value only on the live network. */
export function formatBch(sats: bigint | number): string {
  const v = Number(sats) / 1e8;
  return v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '.0');
}

export function Amount({ sats }: { sats: bigint | number }) {
  const usd = useBchUsd();
  const net = getNetwork();
  const approx = usd && !net.isTestnet ? (Number(sats) / 1e8) * usd : undefined;
  return (
    <span className="num">
      {formatBch(sats)} BCH
      {approx !== undefined && <span className="muted"> (~${approx < 0.01 ? '<0.01' : approx.toFixed(2)})</span>}
      {net.isTestnet && <span className="muted"> test coins</span>}
    </span>
  );
}
