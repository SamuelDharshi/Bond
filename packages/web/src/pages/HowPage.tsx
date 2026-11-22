import { useState } from 'react';
import source from '@bond-source?raw';
import { Card } from '../components/ui';
import { Icon, IconBox } from '../components/icons';

/** Lines that carry the safety guarantees (matched by content, so they survive reformatting). */
const SAFETY = [
  /hash160\(pk\) == maintainerPkh/,
  /lockingBytecode == new LockingBytecodeP2PKH\(contributorPkh\)/,
  /lockingBytecode == charityLock/,
  /value >= tx\.inputs\[i\]\.value - maxFee/,
  /this\.age >= reclaimBlocks/,
  /int i = this\.activeInputIndex/,
];

const TABS = ['Contract', 'Rules', 'Finding bonds'] as const;
type Tab = (typeof TABS)[number];

export function HowPage() {
  const [tab, setTab] = useState<Tab>('Contract');
  const lines = source.replace(/\r/g, '').split('\n');
  return (
    <>
      <div className="eyebrow">How it works</div>
      <h1>One small contract.</h1>
      <p className="lead">The highlighted lines are what make it safe.</p>

      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Contract' && (
        <pre className="code" aria-label="Bond.cash source">
          {lines.map((l, i) => (
            <span key={i} className={`ln ${SAFETY.some((r) => r.test(l)) ? 'hl' : ''}`}>
              {l || ' '}
            </span>
          ))}
        </pre>
      )}

      {tab === 'Rules' && (
        <div className="grid3">
          <Card>
            <IconBox>
              <Icon.Key />
            </IconBox>
            <h3>Refund and forfeit</h3>
            <p className="muted">
              Need the maintainer&apos;s signature. They can pay only you or the charity, never themselves.
            </p>
          </Card>
          <Card>
            <IconBox>
              <Icon.Clock />
            </IconBox>
            <h3>Timeout</h3>
            <p className="muted">
              No signature at all. After the timeout anyone can send the deposit back to you, and nowhere else.
            </p>
          </Card>
          <Card>
            <IconBox>
              <Icon.Shield />
            </IconBox>
            <h3>Checked on every path</h3>
            <p className="muted">
              Output matches input, value comes from the real input, and the fee is capped. One issue, one address.
            </p>
          </Card>
        </div>
      )}

      {tab === 'Finding bonds' && (
        <Card>
          <table className="kv">
            <tbody>
              <tr>
                <td>output 0</td>
                <td>the deposit, paid to the contract</td>
              </tr>
              <tr>
                <td>output 1</td>
                <td>
                  a note: <code>&quot;BOND&quot; · v1 · issue hash · your key hash</code>
                </td>
              </tr>
              <tr>
                <td>output 2</td>
                <td>546 sats to the repo&apos;s registry address, so its history lists every bond</td>
              </tr>
              <tr>
                <td>output 3</td>
                <td>your change</td>
              </tr>
            </tbody>
          </table>
          <p className="small muted" style={{ marginBottom: 0 }}>
            The bot reads the registry history, rebuilds the contract from the repo&apos;s own settings, and accepts a
            bond only if output 0 matches it exactly. The note is a pointer; the match is the proof.
          </p>
        </Card>
      )}
    </>
  );
}
