import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import QRCode from 'qrcode';
import { href } from '../lib/router';
import { LINKS } from '../lib/links';
import './deck.css';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Stagger helper: each child rises in after the previous one. */
function Rise({ children, i = 0, className }: { children: ReactNode; i?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="deck-eyebrow">
    <span className="dk-sq" />
    {children}
  </p>
);

/* ---------------------------------- slides ---------------------------------- */

function Title() {
  return (
    <div className="deck-title">
      <motion.img
        className="deck-mark"
        src={`${import.meta.env.BASE_URL}brand/bond-mark-light.svg`}
        alt=""
        initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      <Rise i={1}>
        <h1>
          <span className="gr">$5</span> to reach a <em>maintainer.</em>
          <br />
          Refunded if you&apos;re <em>human.</em>
        </h1>
      </Rise>
      <Rise i={2}>
        <p className="deck-sub">Refundable anti-spam deposits on Bitcoin Cash, bound to one GitHub issue.</p>
      </Rise>
      <Rise i={3} className="deck-meta">
        <span>BCH BLAZE 2026 · Mainnet Track</span>
        <span>Team: Samuel Dharshi · github.com/SamuelDharshi/Bond</span>
        <span>bond.luffyy.tech</span>
      </Rise>
    </div>
  );
}

function Story() {
  const reduce = useReducedMotion();
  return (
    <div className="deck-cols">
      <div>
        <Eyebrow>The story</Eyebrow>
        <Rise>
          <h2>Maintainers are drowning in AI slop.</h2>
        </Rise>
        <Rise i={1}>
          <p>
            In January 2026 <strong>curl ended its bug bounty</strong>: AI-written &ldquo;vulnerability reports&rdquo;
            cost more to read than real bugs were worth.
          </p>
        </Rise>
        <Rise i={2}>
          <p>
            Sending a fake report costs a bot nothing. Reading it costs a person an hour. Blocking new accounts hurts
            honest newcomers most.
          </p>
        </Rise>
      </div>
      <div className="deck-visual">
        <div className="dk-bars">
          {[
            { label: 'Cost to send slop', w: '4%', tone: 'bad' },
            { label: 'Cost to read it', w: '100%', tone: 'dark' },
          ].map((b, i) => (
            <div key={b.label} className="dk-bar-row">
              <span>{b.label}</span>
              <div className="dk-bar-track">
                <motion.div
                  className={`dk-bar ${b.tone}`}
                  initial={reduce ? { width: b.w } : { width: 0 }}
                  animate={{ width: b.w }}
                  transition={{ duration: 1.3, delay: 0.5 + i * 0.35, ease: EASE }}
                />
              </div>
            </div>
          ))}
        </div>
        <motion.p
          className="deck-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
        >
          Spam is free to send and expensive to read. Bond fixes the economics.
        </motion.p>
      </div>
    </div>
  );
}

const BENEFITS = [
  ['Spam gets expensive', 'Every report needs a real deposit, so mass slop stops being free.'],
  ['Honest people lose nothing', 'The whole deposit comes back, minus a tiny network fee.'],
  ['Maintainers never touch money', 'A label is enough: valid refunds, slop goes to charity.'],
  ['No stuck funds', 'If nobody answers, anyone can send it back after the timeout.'],
  ['No accounts, no backend', 'Everything is read live from the Bitcoin Cash network.'],
  ['Four-step install', 'One config file, one workflow, one secret, three labels.'],
];

function Benefits() {
  return (
    <div>
      <Eyebrow>Benefits</Eyebrow>
      <Rise>
        <h2>Why Bond works.</h2>
      </Rise>
      <div className="deck-grid">
        {BENEFITS.map(([t, d], i) => (
          <Rise key={t} i={i + 1} className="deck-card">
            <span className="dk-n">[ {String(i + 1).padStart(2, '0')} ]</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </Rise>
        ))}
      </div>
    </div>
  );
}

function BchUsage() {
  const reduce = useReducedMotion();
  const outs = [
    ['out 0', 'the deposit, locked in the Bond covenant'],
    ['out 1', 'a note that names the issue'],
    ['out 2', 'a 546-sat ping so the bot can find it'],
    ['out 3', 'change back to you'],
  ];
  const paths = [
    ['refund()', 'bot key → contributor', 'ok'],
    ['forfeit()', 'bot key → charity', 'bad'],
    ['reclaim()', 'anyone, after timeout → contributor', 'ok'],
  ];
  return (
    <div>
      <Eyebrow>BCH usage</Eyebrow>
      <Rise>
        <h2>One transaction locks it. A covenant decides where it goes.</h2>
      </Rise>
      <div className="deck-flow">
        <Rise i={1} className="flow-col">
          <div className="flow-head">Funding transaction</div>
          {outs.map(([a, b], i) => (
            <motion.div
              key={a}
              className="flow-out"
              initial={reduce ? false : { opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.15, duration: 0.6, ease: EASE }}
            >
              <b>{a}</b> {b}
            </motion.div>
          ))}
        </Rise>
        <motion.div
          className="flow-arrow"
          aria-hidden="true"
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.1, duration: 0.7, ease: EASE }}
        />
        <Rise i={3} className="flow-col">
          <div className="flow-head">Bond covenant (CashScript)</div>
          {paths.map(([a, b, tone], i) => (
            <motion.div
              key={a}
              className={`flow-out dk-path ${tone}`}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3 + i * 0.15, duration: 0.6, ease: EASE }}
            >
              <b>{a}</b> {b}
            </motion.div>
          ))}
        </Rise>
      </div>
      <Rise i={5}>
        <p className="deck-note">
          Money can only reach the contributor or the charity. The maintainer key can choose, but can never keep it.
          Signing happens in the user&apos;s wallet over WizardConnect.
        </p>
      </Rise>
    </div>
  );
}

function How() {
  const reduce = useReducedMotion();
  const steps = [
    ['Lock', 'Contributor pastes the issue link and locks a deposit from their wallet.'],
    ['Bonded ✓', 'The repo bot finds it on-chain and labels the issue.'],
    ['Decide', 'Maintainer adds the label valid or slop.'],
    ['Settle', 'Refund, charity, or keyless reclaim after the timeout.'],
  ];
  return (
    <div>
      <Eyebrow>How it works</Eyebrow>
      <Rise>
        <h2>Four steps, every one on-chain.</h2>
      </Rise>
      <div className="deck-steps">
        <motion.div
          className="dk-line"
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 2.2, delay: 0.5, ease: 'easeInOut' }}
        />
        {steps.map(([t, d], i) => (
          <Rise key={t} i={i + 1} className="dk-step">
            <motion.span
              className="dk-dot"
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.6, type: 'spring', stiffness: 300, damping: 14 }}
            >
              {i + 1}
            </motion.span>
            <h3>{t}</h3>
            <p>{d}</p>
          </Rise>
        ))}
      </div>
    </div>
  );
}

function Vision() {
  const items = [
    ['Now', 'Live on Bitcoin Cash with a GitHub Action and a web app.'],
    ['Next', 'Other hosts (GitLab, Gitea) and deposit sizes that depend on the label or the repo.'],
    ['Then', 'Shared maintainer teams and community-chosen charities.'],
    ['Goal', 'A refundable deposit becomes the normal way to reach any busy maintainer.'],
  ];
  return (
    <div>
      <Eyebrow>The vision</Eyebrow>
      <Rise>
        <h2>
          Every repo. Every issue. <em>Real skin in the game.</em>
        </h2>
      </Rise>
      <div className="deck-list">
        {items.map(([t, d], i) => (
          <Rise key={t} i={i + 1} className="dk-row">
            <b>{t}</b>
            <span>{d}</span>
          </Rise>
        ))}
      </div>
    </div>
  );
}

function Thanks() {
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    void QRCode.toDataURL(LINKS.site, { margin: 1, width: 260 }).then(setQr);
  }, []);
  return (
    <div className="deck-title">
      <Rise>
        <h1>Thank you.</h1>
      </Rise>
      <Rise i={1}>
        <p className="deck-sub">Try it: lock a deposit and get it back.</p>
      </Rise>
      <Rise i={2} className="deck-end">
        {qr && <img src={qr} alt="QR code for bond.luffyy.tech" width={170} height={170} />}
        <div>
          <p>
            <b>Live</b> <a href={LINKS.site}>bond.luffyy.tech</a>
          </p>
          <p>
            <b>Source</b> <a href={LINKS.source}>github.com/SamuelDharshi/Bond</a>
          </p>
          <p>
            <b>Built for</b> BCH BLAZE 2026 · Mainnet Track
          </p>
        </div>
      </Rise>
    </div>
  );
}

const SLIDES: { name: string; node: () => ReactNode }[] = [
  { name: 'Title', node: () => <Title /> },
  { name: 'The story', node: () => <Story /> },
  { name: 'Benefits', node: () => <Benefits /> },
  { name: 'BCH usage', node: () => <BchUsage /> },
  { name: 'How it works', node: () => <How /> },
  { name: 'The vision', node: () => <Vision /> },
  { name: 'Thank you', node: () => <Thanks /> },
];

/* ---------------------------------- deck ---------------------------------- */

export function DeckPage() {
  const [i, setI] = useState(() => {
    const n = Number(new URLSearchParams(location.search).get('s'));
    return Number.isInteger(n) && n >= 1 && n <= SLIDES.length ? n - 1 : 0;
  });
  const [dir, setDir] = useState(1);
  const go = useCallback((n: number) => {
    setI((cur) => {
      const next = Math.min(SLIDES.length - 1, Math.max(0, n));
      setDir(next >= cur ? 1 : -1);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        go(i + 1);
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        go(i - 1);
      } else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(SLIDES.length - 1);
      else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go]);

  useEffect(() => {
    history.replaceState(null, '', `${href('/deck')}?s=${i + 1}`);
    document.title = `Bond: ${SLIDES[i].name}`;
  }, [i]);

  // swipe on touch screens
  const touch = useMemo(() => ({ x: 0 }), []);
  const slide = SLIDES[i];

  return (
    <div
      className="deck"
      onTouchStart={(e) => (touch.x = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touch.x;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <a className="deck-home" href={href('/')} aria-label="Back to the Bond site">
        <img src={`${import.meta.env.BASE_URL}brand/bond-logo-light.svg`} alt="bond" height={26} width={108} />
      </a>
      <AnimatePresence mode="wait" custom={dir}>
        <motion.section
          key={i}
          className="deck-slide"
          custom={dir}
          initial={{ opacity: 0, x: dir * 70 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -70 }}
          transition={{ duration: 0.45, ease: EASE }}
          aria-label={slide.name}
        >
          {slide.node()}
        </motion.section>
      </AnimatePresence>
      <nav className="deck-bar" aria-label="Slides">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide">
          ←
        </button>
        <div className="dk-dots">
          {SLIDES.map((s, n) => (
            <button
              key={s.name}
              type="button"
              className={n === i ? 'on' : ''}
              onClick={() => go(n)}
              aria-label={`Slide ${n + 1}: ${s.name}`}
              aria-current={n === i}
            />
          ))}
        </div>
        <span className="dk-count">
          {i + 1} / {SLIDES.length}
        </span>
        <button type="button" onClick={() => go(i + 1)} disabled={i === SLIDES.length - 1} aria-label="Next slide">
          →
        </button>
      </nav>
    </div>
  );
}
