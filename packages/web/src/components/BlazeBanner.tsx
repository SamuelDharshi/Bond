import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { LINKS } from '../lib/links';

const PRESENTATION = LINKS.presentation;
const SOURCE = LINKS.source;
const EMBER = LINKS.ember;

/**
 * A value that is not set yet (dev builds only: production builds refuse to build without all three).
 * Shown as quiet, neutral text with a hint on hover, never as an invented link.
 */
function Pending({ label, name }: { label: string; name: string }) {
  return (
    <span className="banner-pending" title={`Not set yet: ${name}`}>
      {label}
    </span>
  );
}

function EmberVote({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    if (open && !qr) void QRCode.toDataURL(address, { margin: 1, width: 220 }).then(setQr);
  }, [open, qr, address]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the address is selectable in the QR panel */
    }
  };
  return (
    <span className="banner-ember">
      <span className="banner-addr" title={address}>
        Vote with EMBER2026:{' '}
        <code>
          {address.slice(0, 18)}…{address.slice(-6)}
        </code>
      </span>
      <button type="button" onClick={() => void copy()} aria-label="Copy EMBER2026 address">
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Show QR code">
        QR
      </button>
      {open && (
        <span className="banner-qr" role="dialog" aria-label="EMBER2026 address QR">
          {qr && <img src={qr} alt="QR code of the EMBER2026 token address" width={160} height={160} />}
          <code>{address}</code>
        </span>
      )}
    </span>
  );
}

/** Mandatory BCH BLAZE Mainnet Track banner: always the first thing on every page, never dismissible. */
export function BlazeBanner() {
  const ref = useRef<HTMLDivElement>(null);
  // Publish the banner height so the floating nav can sit right below it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--banner-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="blaze-banner" ref={ref} role="region" aria-label="BCH BLAZE 2026 project information">
      <span className="banner-main">
        Built for <strong>BCH BLAZE 2026</strong> · Mainnet Track · New project, built 20–22 Nov 2026
      </span>
      <span className="banner-links">
        {PRESENTATION ? (
          <a href={PRESENTATION} target="_blank" rel="noreferrer">
            Presentation
          </a>
        ) : (
          <Pending label="Presentation" name="VITE_BLAZE_PRESENTATION_URL" />
        )}
        {SOURCE ? (
          <a href={SOURCE} target="_blank" rel="noreferrer">
            Source code
          </a>
        ) : (
          <Pending label="Source code" name="VITE_BLAZE_SOURCE_URL" />
        )}
        {EMBER ? (
          <EmberVote address={EMBER} />
        ) : (
          <Pending label="Vote with EMBER2026" name="VITE_BLAZE_EMBER_ADDRESS" />
        )}
      </span>
    </div>
  );
}
