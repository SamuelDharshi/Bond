import { useMemo, useState } from 'react';
import { SignatureTemplate } from 'cashscript';
import { keyFromWif, parseIssueUrl, type IssueRef } from '@bond/core';
import { buildForfeitTx, buildRefundTx, type DiscoveredBond } from '@bond/contracts';
import { useIssue } from '../lib/useIssue';
import { getChain, humanError } from '../lib/chain';
import { href } from '../lib/router';
import { BondList } from '../components/BondList';
import { Card, ErrorBox, IssueInput, Spinner } from '../components/ui';
import { TxFollow, TxProgress } from '../components/TxProgress';

const DEMO_WIF = import.meta.env.VITE_DEMO_MAINTAINER_WIF;

export function MaintainerPage({ params }: { params: URLSearchParams }) {
  const initial = params.get('issue') ?? '';
  const [ref, setRef] = useState<IssueRef | undefined>(() => {
    try {
      return parseIssueUrl(initial);
    } catch {
      return undefined;
    }
  });
  const issue = useIssue(ref);
  const key = useMemo(() => {
    try {
      return DEMO_WIF ? keyFromWif(DEMO_WIF) : undefined;
    } catch {
      return undefined;
    }
  }, []);
  const [busy, setBusy] = useState<string>();
  const [done, setDone] = useState<Record<string, { kind: string; txid: string }>>({});
  const [err, setErr] = useState<string>();

  const keyMatches = !!key && issue.cfg?.config.maintainerPkh === key.pkhHex;

  const act = async (b: DiscoveredBond, kind: 'refund' | 'forfeit') => {
    if (!key) return;
    setBusy(`${kind}:${b.fundingTxid}`);
    setErr(undefined);
    try {
      const chain = getChain();
      const utxo = (await chain.getUtxos(b.bond.address)).find((u) => u.txid === b.fundingTxid && u.vout === 0);
      if (!utxo) throw new Error('This bond was already spent. Refreshing.');
      const args = {
        bond: b.bond,
        utxo,
        provider: await chain.provider(),
        maintainerKey: new SignatureTemplate(key.privateKey),
      };
      const hex = kind === 'refund' ? buildRefundTx(args) : buildForfeitTx(args);
      const txid = await chain.broadcast(hex);
      setDone((d) => ({ ...d, [b.fundingTxid]: { kind, txid } }));
      setTimeout(issue.refresh, 2500);
    } catch (e) {
      setErr(humanError(e));
      issue.refresh();
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      <h1>Maintainer console</h1>
      <Card>
        <strong>Refund or forfeit a bond</strong>
        <p className="small" style={{ marginBottom: 0 }}>
          This console signs with the repository&apos;s maintainer key, exactly like the GitHub Action does when a
          maintainer adds the <code>valid</code> or <code>slop</code> label. On this network that key is a shared test
          key, so anyone can use the console. Either way the contract only lets it pay the contributor or the charity.
        </p>
      </Card>
      {!key && <ErrorBox error="The maintainer console isn't available in this build." />}
      <IssueInput
        initial={initial}
        cta="Load"
        onSubmit={(r, u) => {
          setRef(r);
          history.replaceState(null, '', href('/maintainer', { issue: u }));
        }}
      />
      {issue.loading && (
        <p className="muted">
          <Spinner /> Reading the chain…
        </p>
      )}
      {issue.error && <ErrorBox error={issue.error} onRetry={issue.refresh} />}
      {issue.cfg && key && !keyMatches && (
        <div className="alert warn">
          This console can&apos;t act on this repository: its maintainer key isn&apos;t available here.
        </div>
      )}
      {err && <ErrorBox error={err} />}
      {issue.cfg && (
        <BondList
          bonds={issue.bonds}
          reclaimBlocks={issue.cfg.config.reclaimBlocks}
          actions={(b) =>
            done[b.fundingTxid] ? (
              <div className="alert ok">
                {done[b.fundingTxid].kind === 'refund' ? 'Refunded to the contributor' : 'Forfeited to charity'}
                <TxFollow txid={done[b.fundingTxid].txid} />
              </div>
            ) : busy?.endsWith(b.fundingTxid) ? (
              <TxProgress phase="signing" signLabel="Signing with the maintainer key" />
            ) : keyMatches && b.utxo ? (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary" disabled={!!busy} onClick={() => void act(b, 'refund')}>
                  {busy === `refund:${b.fundingTxid}` && <Spinner />} Refund (label “valid”)
                </button>
                <button className="btn danger" disabled={!!busy} onClick={() => void act(b, 'forfeit')}>
                  {busy === `forfeit:${b.fundingTxid}` && <Spinner />} Forfeit to charity (label “slop”)
                </button>
              </div>
            ) : null
          }
        />
      )}
      {issue.status === 'unfunded' && ref && (
        <p>
          <a
            className="btn primary"
            href={href('/bond', { issue: `https://github.com/${ref.owner}/${ref.repo}/issues/${ref.number}` })}
          >
            Bond this issue first
          </a>
        </p>
      )}
    </>
  );
}
