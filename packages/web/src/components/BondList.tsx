import type { DiscoveredBond } from '@bond/contracts';
import { blocksToMinutes, getNetwork, hexToBin, pkhToAddress, requiredConfirmations } from '@bond/core';
import { AddrLink, StatusPill, TxLink } from './ui';
import { Amount } from './Amount';
import { HoverCard } from './motion';

export function BondList({
  bonds,
  reclaimBlocks,
  actions,
}: {
  bonds: DiscoveredBond[];
  reclaimBlocks: number;
  actions?: (b: DiscoveredBond) => React.ReactNode;
}) {
  const net = getNetwork();
  if (bonds.length === 0)
    return <p className="muted">No bonds found for this issue in the repo&apos;s registry history.</p>;
  return (
    <>
      {bonds.map((b, i) => (
        <HoverCard key={b.fundingTxid} index={i}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>
              <Amount sats={b.valueSats} />
            </strong>
            <StatusPill status={b.status} />
          </div>
          <table className="kv" style={{ marginTop: 8 }}>
            <tbody>
              <tr>
                <td>Funded</td>
                <td>
                  <TxLink txid={b.fundingTxid} />{' '}
                  <span className="small muted">
                    {b.confirmations > 0 ? `${b.confirmations} conf.` : 'unconfirmed (mempool)'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Contract</td>
                <td>
                  <AddrLink address={b.bond.address} />
                </td>
              </tr>
              <tr>
                <td>Contributor</td>
                <td>
                  <AddrLink address={pkhToAddress(hexToBin(b.contributorPkh))} />
                </td>
              </tr>
              {b.spendTxid && (
                <tr>
                  <td>
                    {b.status === 'forfeited' ? 'Forfeited' : b.status === 'reclaimed' ? 'Reclaimed' : 'Refunded'}
                  </td>
                  <td>
                    <TxLink txid={b.spendTxid} />
                  </td>
                </tr>
              )}
              {(b.status === 'bonded' || b.status === 'reclaimable') && (
                <tr>
                  <td>Timeout</td>
                  <td>
                    {b.status === 'reclaimable'
                      ? 'passed: anyone can return it to the contributor'
                      : `about ${blocksToMinutes(Math.max(1, requiredConfirmations(reclaimBlocks) - b.confirmations))} more minute(s) on ${net.name}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {actions?.(b)}
        </HoverCard>
      ))}
    </>
  );
}
