import { useEffect, useMemo, useRef, useState } from 'react';
import { WizardConnectQRDialog } from '@wizardconnect/react';
import { getNetwork, lockMinutes, parseIssueUrl, type IssueRef } from '@bond/core';
import { useIssue } from '../lib/useIssue';
import { useWallet } from '../lib/walletContext';
import { fundWithWizardConnect, readWallet, WalletError, type FundResult, type WalletView } from '../lib/wallet';
import { humanError } from '../lib/chain';
import { saveMyBond } from '../lib/history';
import { href } from '../lib/router';
import { AddrLink, Card, ErrorBox, IssueInput, Spinner, StatusPill, TxLink, sats } from '../components/ui';
import { Amount } from '../components/Amount';
import { TxFollow, TxProgress } from '../components/TxProgress';
import { Icon } from '../components/icons';
import { motion } from '../components/motion';

function safeParse(u: string | null): IssueRef | undefined {
  try {
    return u ? parseIssueUrl(u) : undefined;
  } catch {
    return undefined;
  }
}

const STEPS = ['Issue', 'Wallet', 'Lock'] as const;

function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper" aria-label="Progress">
      {STEPS.map((label, i) => (
        <div key={label} className={`step ${step === i + 1 ? 'on' : ''} ${step > i + 1 ? 'done' : ''}`}>
          <b>{step > i + 1 ? <Icon.Check /> : i + 1}</b>
          {label}
        </div>
      ))}
    </div>
  );
}

export function BondPage({ params }: { params: URLSearchParams }) {
  const initial = params.get('issue') ?? '';
  const [ref, setRef] = useState<IssueRef | undefined>(() => safeParse(initial));
  const [issueUrl, setIssueUrl] = useState(initial);
  const issue = useIssue(ref);
  const wallet = useWallet();
  const net = getNetwork();

  const [step, setStep] = useState(1);
  const [view, setView] = useState<WalletView>();
  const [walletErr, setWalletErr] = useState<string>();
  const [busy, setBusy] = useState<'reading' | 'signing' | undefined>();
  const [result, setResult] = useState<FundResult>();
  const abort = useRef<AbortController>();

  const loadWallet = useMemo(
    () => async () => {
      if (!wallet.manager) return;
      setBusy('reading');
      setWalletErr(undefined);
      try {
        setView(await readWallet(wallet.manager));
      } catch (e) {
        setWalletErr(e instanceof WalletError ? e.message : humanError(e));
      } finally {
        setBusy(undefined);
      }
    },
    [wallet.manager],
  );

  useEffect(() => {
    if (wallet.state === 'connected') void loadWallet();
    else setView(undefined);
  }, [wallet.state, loadWallet]);

  // Move on automatically once the wallet is connected and readable.
  useEffect(() => {
    if (step === 2 && view) setStep(3);
  }, [step, view]);

  const fund = async () => {
    if (!wallet.manager || !view || !ref || !issue.cfg) return;
    setBusy('signing');
    setWalletErr(undefined);
    abort.current = new AbortController();
    try {
      const r = await fundWithWizardConnect(wallet.manager, view, issue.cfg.config, ref, abort.current.signal);
      setResult(r);
      saveMyBond({ issueUrl, txid: r.txid, amountSats: r.amountSats.toString(), contractAddress: r.bond.address });
      issue.refresh();
    } catch (e) {
      setWalletErr(e instanceof WalletError ? e.message : humanError(e));
    } finally {
      setBusy(undefined);
    }
  };

  const cfg = issue.cfg?.config;
  const live = issue.bonds.filter((b) => b.status === 'bonded' || b.status === 'reclaimable');

  return (
    <>
      <div className="eyebrow">Bond an issue</div>
      <h1>Lock a deposit.</h1>
      {!result && <Stepper step={step} />}

      <motion.div
        key={result ? 'done' : step}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* ---- step 1: pick the issue and read its terms ---- */}
        {!result && step === 1 && (
          <>
            <IssueInput
              initial={issueUrl}
              cta="Load terms"
              onSubmit={(r, u) => {
                setRef(r);
                setIssueUrl(u);
                history.replaceState(null, '', href('/bond', { issue: u }));
              }}
            />
            {issue.loading && !cfg && (
              <p className="muted">
                <Spinner /> Loading the repository&apos;s terms…
              </p>
            )}
            {issue.error && <ErrorBox error={issue.error} onRetry={issue.refresh} />}
            {cfg && ref && (
              <Card>
                <h3>
                  {ref.owner}/{ref.repo}#{ref.number}
                </h3>
                <table className="kv" style={{ marginTop: 8 }}>
                  <tbody>
                    <tr>
                      <td>Deposit</td>
                      <td>
                        <Amount sats={cfg.minValueSats} />
                      </td>
                    </tr>
                    <tr>
                      <td>If labelled “{cfg.labels.valid}”</td>
                      <td>Refunded to you</td>
                    </tr>
                    <tr>
                      <td>If labelled “{cfg.labels.slop}”</td>
                      <td>
                        Sent to charity <AddrLink address={cfg.charityAddress} />
                      </td>
                    </tr>
                    <tr>
                      <td>If nobody acts</td>
                      <td>After ~{lockMinutes(cfg.reclaimBlocks)} minutes anyone can return it to you</td>
                    </tr>
                    <tr>
                      <td>Max fee on exit</td>
                      <td>{sats(cfg.maxFeeSats)}</td>
                    </tr>
                    {issue.status && (
                      <tr>
                        <td>Status</td>
                        <td>
                          <StatusPill status={issue.status} />{' '}
                          <a className="small" href={href('/status', { issue: issueUrl })}>
                            details
                          </a>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {live.length > 0 && (
                  <div className="alert warn">
                    This issue already has a live bond (<Amount sats={live[0].valueSats} />
                    ). You can add another.
                  </div>
                )}
                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn primary" onClick={() => setStep(2)}>
                    Continue <Icon.Arrow />
                  </button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ---- step 2: connect a wallet ---- */}
        {!result && step === 2 && (
          <Card>
            <h3>Connect your wallet</h3>
            {wallet.state !== 'connected' ? (
              <>
                <p className="muted">
                  Scan the QR code with a WizardConnect wallet set to <strong>{net.name}</strong>, or tap the link on
                  mobile.
                </p>
                <div className="row">
                  <button
                    className="btn primary"
                    onClick={() => wallet.connect()}
                    disabled={wallet.state === 'connecting'}
                  >
                    {wallet.state === 'connecting' ? (
                      <>
                        <Spinner /> Waiting for wallet…
                      </>
                    ) : (
                      <>
                        <Icon.Wallet /> Connect with WizardConnect
                      </>
                    )}
                  </button>
                  <button className="btn ghost" onClick={() => setStep(1)}>
                    Back
                  </button>
                </div>
                {wallet.uri && wallet.state === 'connecting' && (
                  <p className="small">
                    On mobile? <a href={wallet.uri}>Open in wallet app</a>
                  </p>
                )}
                {wallet.error && (
                  <ErrorBox error={`Wallet connection failed: ${wallet.error}`} onRetry={wallet.retry} />
                )}
                {wallet.timedOut && (
                  <ErrorBox
                    error="No wallet answered through the relay. Check the wallet is online and retry."
                    onRetry={wallet.retry}
                  />
                )}
                {wallet.uri && wallet.qrUri && (
                  <WizardConnectQRDialog
                    show={wallet.state === 'connecting'}
                    onClose={() => void wallet.disconnect()}
                    uri={wallet.uri}
                    qrUri={wallet.qrUri}
                    title="Connect a wallet to Bond"
                    subtitle={`Scan with a WizardConnect wallet (${net.name})`}
                  />
                )}
              </>
            ) : (
              <>
                <p>
                  Connected{wallet.walletName ? ` to ${wallet.walletName}` : ''}.
                  {busy === 'reading' && (
                    <>
                      {' '}
                      <Spinner /> Reading your addresses and balance…
                    </>
                  )}
                </p>
              </>
            )}
            {walletErr && <ErrorBox error={walletErr} onRetry={() => void loadWallet()} />}
          </Card>
        )}

        {/* ---- step 3: lock ---- */}
        {!result && step === 3 && cfg && view && (
          <Card>
            <h3>Lock the deposit</h3>
            <table className="kv" style={{ margin: '8px 0 14px' }}>
              <tbody>
                <tr>
                  <td>Refund address</td>
                  <td>
                    <AddrLink address={view.address} />
                  </td>
                </tr>
                <tr>
                  <td>Wallet balance</td>
                  <td>
                    <Amount sats={view.balance} />{' '}
                    <button className="btn sm ghost" onClick={() => void loadWallet()}>
                      refresh
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>Deposit</td>
                  <td>
                    <Amount sats={cfg.minValueSats} />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="muted small">
              Your wallet will show the deposit, a note that identifies the issue, a tiny ping so the repo&apos;s bot
              can find you, and your change.
            </p>
            <div className="row">
              <button className="btn primary" disabled={!!busy} onClick={() => void fund()}>
                {busy === 'signing' ? (
                  <>
                    <Spinner /> Approve in your wallet…
                  </>
                ) : (
                  <>
                    <Icon.Lock /> Lock deposit
                  </>
                )}
              </button>
              {busy === 'signing' ? (
                <button className="btn" onClick={() => abort.current?.abort()}>
                  Cancel
                </button>
              ) : (
                <button className="btn ghost" onClick={() => setStep(1)}>
                  Change issue
                </button>
              )}
            </div>
            {busy === 'signing' && <TxProgress phase="signing" />}
            {walletErr && <ErrorBox error={walletErr} onRetry={() => void fund()} />}
          </Card>
        )}

        {/* ---- done ---- */}
        {result && (
          <div className="alert ok">
            <h3 style={{ marginTop: 0 }}>Bonded (broadcast to {net.name})</h3>
            <table className="kv">
              <tbody>
                <tr>
                  <td>Transaction</td>
                  <td>
                    <TxLink txid={result.txid} label={result.txid} />
                  </td>
                </tr>
                <tr>
                  <td>Contract</td>
                  <td>
                    <AddrLink address={result.bond.address} />
                  </td>
                </tr>
                <tr>
                  <td>Amount</td>
                  <td>
                    <Amount sats={result.amountSats} />
                  </td>
                </tr>
              </tbody>
            </table>
            <TxFollow txid={result.txid} />
            <p className="small">
              The repo&apos;s bot will label the issue “bonded ✓”. Next:{' '}
              <a href={href('/status', { issue: issueUrl })}>watch the status</a>, see it in{' '}
              <a href={href('/mybonds')}>my bonds</a>, or{' '}
              <a href={href('/maintainer', { issue: issueUrl })}>act as the maintainer</a>.
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
}
