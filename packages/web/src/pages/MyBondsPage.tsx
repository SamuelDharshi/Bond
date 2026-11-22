import { useMemo } from 'react';
import { parseIssueUrl } from '@bond/core';
import { loadMyBonds, type MyBond } from '../lib/history';
import { useIssue } from '../lib/useIssue';
import { href } from '../lib/router';
import { Amount } from '../components/Amount';
import { Spinner, StatusPill, TxLink } from '../components/ui';

function Row({ b }: { b: MyBond }) {
  const ref = useMemo(() => {
    try {
      return parseIssueUrl(b.issueUrl);
    } catch {
      return undefined;
    }
  }, [b.issueUrl]);
  const issue = useIssue(ref);
  const mine = issue.bonds.find((x) => x.fundingTxid === b.txid);
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{ref ? `${ref.owner}/${ref.repo}#${ref.number}` : b.issueUrl}</strong>
        {mine ? (
          <StatusPill status={mine.status} />
        ) : issue.loading ? (
          <Spinner />
        ) : (
          <span className="muted small">pending</span>
        )}
      </div>
      <table className="kv" style={{ marginTop: 8 }}>
        <tbody>
          <tr>
            <td>Amount</td>
            <td>
              <Amount sats={BigInt(b.amountSats)} />
            </td>
          </tr>
          <tr>
            <td>Transaction</td>
            <td>
              <TxLink txid={b.txid} />
            </td>
          </tr>
          <tr>
            <td>When</td>
            <td>{new Date(b.at).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <p className="small" style={{ marginBottom: 0 }}>
        <a href={b.issueUrl} target="_blank" rel="noreferrer">
          Open the issue on GitHub
        </a>{' '}
        · <a href={href('/status', { issue: b.issueUrl })}>Full status</a>
      </p>
    </div>
  );
}

export function MyBondsPage() {
  const bonds = useMemo(loadMyBonds, []);
  return (
    <>
      <h1>My bonds</h1>
      <p className="muted">Deposits you locked from this browser. Status is read live from the chain.</p>
      {bonds.length === 0 ? (
        <p>
          Nothing here yet. <a href={href('/bond')}>Bond an issue</a> and it will show up here.
        </p>
      ) : (
        bonds.map((b) => <Row key={b.txid} b={b} />)
      )}
    </>
  );
}
