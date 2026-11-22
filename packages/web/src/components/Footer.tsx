import { useState } from 'react';
import { LIVE_NETWORK, getNetwork, getNetworkConfig } from '@bond/core';
import { href } from '../lib/router';
import { onPracticeNetwork, togglePracticeNetwork } from '../lib/network';
import { Logo } from './Logo';

const PRESENTATION = import.meta.env.VITE_BLAZE_PRESENTATION_URL?.trim();
const SOURCE = import.meta.env.VITE_BLAZE_SOURCE_URL?.trim();
const EMBER = import.meta.env.VITE_BLAZE_EMBER_ADDRESS?.trim();

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="f-ember">
      <code title={address}>
        {address.slice(0, 16)}…{address.slice(-6)}
      </code>
      <button
        className="btn sm"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(address)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => undefined);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function Footer() {
  const net = getNetwork();
  return (
    <footer>
      <div className="wrap">
        <div className="f-top">
          <div>
            <Logo height={22} />
            <p className="f-b">Refundable deposits for GitHub issues, enforced by a Bitcoin Cash contract.</p>
          </div>
          <div className="f-col">
            <h4>This submission</h4>
            <ul>
              {PRESENTATION && (
                <li>
                  <a href={PRESENTATION} target="_blank" rel="noreferrer">
                    Deck
                  </a>
                </li>
              )}
              {SOURCE && (
                <li>
                  <a href={SOURCE} target="_blank" rel="noreferrer">
                    Source code
                  </a>
                </li>
              )}
              <li>
                <a href={href('/judges')}>Judges: start here</a>
              </li>
              <li>
                <a href={href('/how')}>The contract</a>
              </li>
            </ul>
          </div>
          <div className="f-col">
            <h4>Product</h4>
            <ul>
              <li>
                <a href={href('/bond')}>Bond an issue</a>
              </li>
              <li>
                <a href={href('/status')}>Status</a>
              </li>
              <li>
                <a href={href('/maintainer')}>Maintainer console</a>
              </li>
            </ul>
          </div>
          <div className="f-col">
            <h4>Vote with EMBER2026</h4>
            {EMBER ? <CopyAddress address={EMBER} /> : <p className="small muted">Address set at deploy time.</p>}
            <h4 style={{ marginTop: 18 }}>Network: {net.label}</h4>
            <ul>
              <li>
                <button className="btn sm" onClick={togglePracticeNetwork}>
                  {onPracticeNetwork() ? `Back to ${getNetworkConfig(LIVE_NETWORK).name}` : 'Practice on testnet'}
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="f-bottom">
          <p className="legal">
            Bond is experimental, open-source (MIT) and unaudited. Nothing here is financial advice, and a deposit
            proves money, not identity. Every status is read live from the Bitcoin Cash network.
            {net.isTestnet && ` You are on ${net.label}: test coins only.`}
          </p>
          <p>Built for BCH BLAZE 2026</p>
        </div>
      </div>
    </footer>
  );
}
