import { useState, type ReactNode } from 'react';
import { getNetwork, parseIssueUrl, type IssueRef } from '@bond/core';
import type { BondStatus } from '@bond/contracts';

export function TxLink({ txid, label }: { txid: string; label?: string }) {
  return (
    <a className="mono" href={getNetwork().explorerTx(txid)} target="_blank" rel="noreferrer">
      {label ?? `${txid.slice(0, 12)}…${txid.slice(-6)}`}
    </a>
  );
}

export function AddrLink({ address }: { address: string }) {
  return (
    <a className="mono" href={getNetwork().explorerAddress(address)} target="_blank" rel="noreferrer">
      {address}
    </a>
  );
}

export function StatusPill({ status }: { status: BondStatus }) {
  return <span className={`status ${status}`}>{status}</span>;
}

export const sats = (v: bigint | number) => `${BigInt(v).toLocaleString('en-US')} sats`;

export function Spinner() {
  return <span className="spinner" aria-label="loading" />;
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="alert err" role="alert">
      {error}
      {onRetry && (
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export function IssueInput({
  initial,
  onSubmit,
  cta = 'Load',
}: {
  initial: string;
  onSubmit: (ref: IssueRef, url: string) => void;
  cta?: string;
}) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string>();
  const submit = () => {
    try {
      const ref = parseIssueUrl(v);
      setErr(undefined);
      onSubmit(ref, v.trim());
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div>
      <div className="field">
        <input
          type="text"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="https://github.com/owner/repo/issues/1"
          aria-label="GitHub issue or PR URL"
        />
        <button className="btn primary" onClick={submit}>
          {cta}
        </button>
      </div>
      {err && <div className="alert err">{err}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className ?? ''}`}>{children}</section>;
}
