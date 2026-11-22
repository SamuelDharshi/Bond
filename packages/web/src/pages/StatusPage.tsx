import { useState } from 'react';
import { isTimelockNotReached, notYetMessage, parseIssueUrl, type IssueRef } from '@bond/core';
import { buildReclaimTx, type DiscoveredBond } from '@bond/contracts';
import { DEMO_ISSUE_URL } from '../lib/config';
import { useIssue } from '../lib/useIssue';
import { getChain, humanError } from '../lib/chain';
import { href } from '../lib/router';
import { BondList } from '../components/BondList';
import { ErrorBox, IssueInput, Spinner, StatusPill } from '../components/ui';
import { TxFollow, TxProgress } from '../components/TxProgress';

export function StatusPage({ params }: { params: URLSearchParams }) {
  const initial = params.get('issue') || DEMO_ISSUE_URL;
  const [ref, setRef] = useState<IssueRef | undefined>(() => {
    try {
      return parseIssueUrl(initial);
    } catch {
      return undefined;
    }
  });
  const issue = useIssue(ref);
  const [busy, setBusy] = useState<string>();
  const [done, setDone] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string>();
  const [notice, setNotice] = useState<string>();

  /** Permissionless reclaim: no wallet, no key. Only public chain data. */
  const reclaim = async (b: DiscoveredBond) => {
    if (!b.utxo) return;
    setBusy(b.fundingTxid);
    setErr(undefined);
    setNotice(undefined);
    try {
      const chain = getChain();
      // Re-check right before spending.
      const fresh = (await chain.getUtxos(b.bond.address)).find((u) => u.txid === b.fundingTxid && u.vout === 0);
      if (!fresh) throw new Error('This bond was already spent. Refreshing.');
      const hex = buildReclaimTx({ bond: b.bond, utxo: fresh, provider: await chain.provider() });
      const txid = await chain.broadcast(hex);
      setDone((d) => ({ ...d, [b.fundingTxid]: txid }));
      setTimeout(issue.refresh, 2500);
    } catch (e) {
      // The node is the final judge of the timelock: show a friendly wait message, never a crash.
      if (isTimelockNotReached(e)) setNotice(notYetMessage(b.confirmations, issue.cfg?.config.reclaimBlocks ?? 1));
      else setErr(humanError(e));
      issue.refresh();
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      <h1>Bond status</h1>
      <IssueInput
        initial={initial}
        cta="Check"
        onSubmit={(r, u) => {
          setRef(r);
          history.replaceState(null, '', href('/status', { issue: u }));
        }}
      />
      {issue.loading && (
        <p className="muted">
          <Spinner /> Reading the chain…
        </p>
      )}
      {issue.error && <ErrorBox error={issue.error} onRetry={issue.refresh} />}
      {err && <ErrorBox error={err} />}
      {notice && <div className="alert warn">{notice}</div>}
      {issue.status && ref && issue.cfg && (
        <>
          <p>
            {ref.owner}/{ref.repo}#{ref.number}: <StatusPill status={issue.status} />{' '}
            <button className="btn" style={{ padding: '2px 10px', fontSize: 13 }} onClick={issue.refresh}>
              Refresh
            </button>
            {issue.tip && <span className="small muted"> · tip {issue.tip}</span>}
          </p>
          {issue.status === 'unfunded' && (
            <p>
              <a
                className="btn primary"
                href={href('/bond', { issue: `https://github.com/${ref.owner}/${ref.repo}/issues/${ref.number}` })}
              >
                Bond this issue
              </a>
            </p>
          )}
          <BondList
            bonds={issue.bonds}
            reclaimBlocks={issue.cfg.config.reclaimBlocks}
            actions={(b) =>
              done[b.fundingTxid] ? (
                <div className="alert ok">
                  Returned to the contributor
                  <TxFollow txid={done[b.fundingTxid]} />
                </div>
              ) : busy === b.fundingTxid ? (
                <TxProgress phase="signing" signLabel="Building the reclaim transaction" />
              ) : b.status === 'reclaimable' ? (
                <div style={{ marginTop: 10 }}>
                  <button className="btn primary" disabled={!!busy} onClick={() => void reclaim(b)}>
                    {busy === b.fundingTxid ? <Spinner /> : null} Return deposit to contributor
                  </button>
                  <p className="small muted">
                    No wallet needed: the contract only allows this payment, to this address.
                  </p>
                </div>
              ) : null
            }
          />
        </>
      )}
    </>
  );
}
