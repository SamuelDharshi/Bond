import { LIVE_NETWORK, getNetwork, getNetworkConfig } from '@bond/core';
import { href } from '../lib/router';
import { proofTxids } from '../lib/proof';
import { Amount } from '../components/Amount';
import { HoverCard, Reveal } from '../components/motion';
import { Icon, IconBox } from '../components/icons';
import { TxLink } from '../components/ui';

const VIDEO = import.meta.env.VITE_BLAZE_VIDEO_URL?.trim();

export function JudgesPage() {
  const net = getNetwork();
  const proofs = proofTxids();
  const steps = [
    {
      icon: <Icon.Wallet />,
      title: 'Open a wallet',
      text: net.isTestnet
        ? 'Use a WizardConnect wallet set to the test network. Free test coins: tbch.googol.cash.'
        : 'Use a WizardConnect wallet with a little BCH. The deposit comes back to you.',
    },
    {
      icon: <Icon.Lock />,
      title: 'Bond an issue',
      text: 'Scan the QR, approve, and watch the transaction appear.',
      to: href('/bond'),
      cta: 'Bond it',
    },
    {
      icon: <Icon.Key />,
      title: 'Act as the maintainer',
      text: 'Press Refund and the deposit goes back to your wallet.',
      to: href('/maintainer'),
      cta: 'Open console',
    },
    {
      icon: <Icon.Check />,
      title: 'Check the proof',
      text: 'Every step links to the explorer.',
      to: href('/status'),
      cta: 'See status',
    },
  ];
  return (
    <>
      <div className="eyebrow">For judges</div>
      <h1>90 seconds, one full round trip.</h1>
      <p className="lead">
        Deposit <Amount sats={50000} />, then get it back.
      </p>
      {net.isTestnet && (
        <div className="alert warn">
          You&apos;re on the {net.label} practice network. For the live flow, use{' '}
          <em>Back to {getNetworkConfig(LIVE_NETWORK).name}</em> in the footer.
        </div>
      )}

      <div className="steps" style={{ marginTop: 28 }}>
        {steps.map((s, i) => (
          <HoverCard key={s.title} index={i}>
            <IconBox>{s.icon}</IconBox>
            <h3>
              <span className="num muted">{i + 1}. </span>
              {s.title}
            </h3>
            <p>{s.text}</p>
            {s.to && (
              <p style={{ marginTop: 14 }}>
                <a className="btn sm" href={s.to}>
                  {s.cta} <Icon.Arrow />
                </a>
              </p>
            )}
          </HoverCard>
        ))}
      </div>

      <Reveal>
        <h2 style={{ fontSize: 28, margin: '44px 0 10px' }}>No wallet handy?</h2>
        {VIDEO && (
          <p>
            <a href={VIDEO} target="_blank" rel="noreferrer">
              Watch the 2-minute video →
            </a>
          </p>
        )}
        {proofs.length > 0 ? (
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              Real {net.name} transactions from our test runs:
            </p>
            <table className="kv">
              <tbody>
                {proofs.map((p) => (
                  <tr key={p.txid + p.label}>
                    <td>{p.label}</td>
                    <td>
                      <TxLink txid={p.txid} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Transactions for this network will be listed here once recorded.</p>
        )}
        <p className="small muted">
          The maintainer console signs with a public shared key. The contract only lets that key pay the person who
          bonded or the charity, so it can refund but never take the money.
        </p>
      </Reveal>
    </>
  );
}
