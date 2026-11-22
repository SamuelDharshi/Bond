import { useEffect, useState } from 'react';
import { getNetwork, lockMinutes } from '@bond/core';
import { href } from '../lib/router';
import { DEMO_ISSUE_URL, DEMO_REPO } from '../lib/demoRepo';
import { introEntered, onIntroEntering, runIntro } from '../lib/intro';
import { proofTxids } from '../lib/proof';
import { useBchUsd } from '../lib/price';
import { TEAM } from '../team';
import { InkField } from '../components/InkField';
import { InkRings } from '../components/InkRings';
import { ContractScene } from '../components/ContractScene';
import { PixelAvatar } from '../components/PixelAvatar';
import { Reveal } from '../components/motion';
import { formatBch } from '../components/Amount';
import { TxLink } from '../components/ui';

const SOURCE = import.meta.env.VITE_BLAZE_SOURCE_URL?.trim();

const WHY = [
  {
    n: '01',
    title: 'Spam costs money',
    text: 'A report that costs nothing to send costs a maintainer an hour to read. A refundable deposit puts a price on the first one.',
  },
  {
    n: '02',
    title: 'Humans get it back',
    text: 'Label it valid, or let the timeout pass, and the deposit returns to the person who bonded it. A genuine report is free.',
  },
  {
    n: '03',
    title: "Maintainers can't take it",
    text: 'The contract only pays the contributor or a charity. A maintainer, or a stolen bot key, cannot keep the money.',
  },
] as const;

const FLOW = [
  {
    b: 'bond',
    s: 'You lock the deposit. A note and a tiny ping let the repo find it with plain address history.',
    c: ['out[0] bond → P2SH32', 'out[1] OP_RETURN "BOND" 01 subjectHash pkh', 'out[2] 546 sats → registry'],
  },
  {
    b: 'label',
    s: 'The maintainer labels the issue. The GitHub Action reads the label and rebuilds the bond from the repo’s own settings.',
    c: ['if (label === labels.valid) refund', 'if (label === labels.slop) forfeit'],
  },
  {
    b: 'refund | forfeit',
    s: 'The Action signs with a key the contract limits to two destinations: you, or the charity.',
    c: ['require(tx.outputs[i].lockingBytecode', '  == charityLock);'],
  },
  {
    b: 'reclaim',
    s: 'No label before the timeout? Anyone can broadcast reclaim(). No key, and only you can be paid.',
    c: ['require(this.age >= reclaimBlocks);'],
  },
] as const;

const FACETS = [
  {
    n: '01',
    title: 'Contract',
    text: 'A 119-byte CashScript covenant with three spend paths. One address per issue, fees capped, outputs checked.',
    to: href('/how'),
    link: 'Read the contract',
  },
  {
    n: '02',
    title: 'GitHub Action',
    text: 'Labels bonded issues, refunds on valid, forfeits on slop, and returns timed-out bonds. Idempotent by design.',
    to: SOURCE ? `${SOURCE}/tree/main/packages/action` : href('/how'),
    link: 'See the Action',
  },
  {
    n: '03',
    title: 'WizardConnect',
    text: 'Connect a wallet by QR or link. The funding transaction is signed in the wallet and broadcast by the app.',
    to: href('/bond'),
    link: 'Bond an issue',
  },
  {
    n: '04',
    title: 'No backend',
    text: 'The site and the bot read the Bitcoin Cash network directly. There is no server or database to trust.',
    to: href('/status'),
    link: 'Check a bond',
  },
] as const;

/** Landing page: ink stage, page sheet that slides over it, live stats, steps, 3D contract scene. */
export function Home() {
  const net = getNetwork();
  const usd = useBchUsd();
  const [tip, setTip] = useState<number | 'offline'>();
  const [settled, setSettled] = useState(introEntered);

  // Intro: after the loader, the page slides up over the ink and the bar slides down.
  useEffect(() => {
    const off = onIntroEntering(() => setSettled(true));
    runIntro();
    return off;
  }, []);

  useEffect(() => {
    document.title = 'Bond: refundable deposits for GitHub issues';
    let alive = true;
    import('../lib/chain')
      .then((m) => m.getChain().getTipHeight())
      .then((h) => alive && setTip(h))
      .catch(() => alive && setTip('offline'));
    return () => {
      alive = false;
    };
  }, []);

  const proofs = proofTxids();
  const fundTx = proofs.find((p) => /fund/i.test(p.label));
  const deposit = 50000;
  const approx =
    usd && !net.isTestnet ? `about $${((deposit / 1e8) * usd).toFixed(2)}` : net.isTestnet ? 'test coins' : '';
  const demoRepoUrl = `https://github.com/${DEMO_REPO[0]}/${DEMO_REPO[1]}`;
  const repoConfigured = Boolean(import.meta.env.VITE_DEMO_REPO);

  return (
    <div className="home">
      <InkField settled={settled} />
      <div className="page-root">
        <header className="hero">
          <InkRings />
          <div className="hero-content">
            <div className="wrap">
              <div className="hero-copy">
                <p className="eyebrow">Bitcoin Cash · anti-spam deposits</p>
                <h1>
                  $5 to reach a maintainer.
                  <br />
                  Refunded if you&apos;re human.
                </h1>
              </div>
            </div>
          </div>
          <span className="scroll-hint" aria-hidden="true">
            Scroll ↓
          </span>
        </header>

        <div className="page-sheet">
          <div className="hero-sub">
            <div className="wrap">
              <p className="lead">
                Lock a small deposit to open an issue. Genuine reports get it back. Spam pays a charity.
              </p>
              <div className="actions">
                <a className="btn primary" href={href('/bond', { issue: DEMO_ISSUE_URL })}>
                  Bond an issue
                </a>
                <a className="btn" href={href('/how')}>
                  Read the contract
                </a>
                <a className="btn" href={href('/judges')}>
                  Judges: start here
                </a>
              </div>
            </div>
          </div>

          <section className="sec" style={{ paddingTop: 28, paddingBottom: 0 }}>
            <div className="wrap">
              <div className="strip-card">
                <div className="strip-bar">
                  <span className="live">Live on {net.label}</span>
                  <span>Read from the chain, no server</span>
                </div>
                <div className="stats">
                  <div className="stat">
                    <div className="stat-k">Block height</div>
                    <div className="stat-v ok">
                      {tip === undefined ? '…' : tip === 'offline' ? 'offline' : tip.toLocaleString('en-US')}
                    </div>
                    <div className="stat-c">latest block on {net.name}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-k">Typical deposit</div>
                    <div className="stat-v">{formatBch(deposit)} BCH</div>
                    <div className="stat-c">{approx}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-k">Timeout</div>
                    <div className="stat-v">~{lockMinutes(1)} min</div>
                    <div className="stat-c">then anyone can return it</div>
                  </div>
                  <div className="stat">
                    <div className="stat-k">Ways out</div>
                    <div className="stat-v">3</div>
                    <div className="stat-c">refund, forfeit, reclaim</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="sec" id="how">
            <div className="wrap">
              <Reveal>
                <div className="sec-head">
                  <p className="eyebrow">How it works</p>
                  <h2>Spam is free to send. Reading it isn&apos;t.</h2>
                  <p className="lead">A deposit that proves you mean it, and comes back when you do.</p>
                </div>
              </Reveal>
              <div className="steps three">
                {WHY.map((s, i) => (
                  <Reveal key={s.n} delay={i * 0.08}>
                    <div className="step-card" style={{ height: '100%' }}>
                      <div className="step-n">[ {s.n} ]</div>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section className="sec" style={{ paddingTop: 0 }} id="connects">
            <div className="wrap">
              <Reveal>
                <div className="band">
                  <p className="eyebrow">How it connects</p>
                  <h2>From a deposit to a decision.</h2>
                  <p className="lead">
                    One transaction in, one transaction out. The contract decides where money may go.
                  </p>
                  <div className="flow">
                    {FLOW.map((f) => (
                      <div className="fl" key={f.b}>
                        <b>{f.b}</b>
                        <span>{f.s}</span>
                        <pre>
                          {f.c.map((line) => (
                            <code key={line}>{line}</code>
                          ))}
                        </pre>
                      </div>
                    ))}
                  </div>
                  <p className="band-note">
                    Finding a bond uses only the repo&apos;s own settings, so a bond made with someone else&apos;s keys
                    or charity is simply ignored.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>

          <ContractScene />

          <section className="sec" id="facets">
            <div className="wrap">
              <Reveal>
                <div className="sec-head">
                  <p className="eyebrow">Four facets</p>
                  <h2>One system, four pieces.</h2>
                  <p className="lead">Each piece runs on its own. Together they make a deposit that settles itself.</p>
                </div>
              </Reveal>
              <div className="steps">
                {FACETS.map((f, i) => (
                  <Reveal key={f.n} delay={i * 0.06}>
                    <div className="step-card" style={{ height: '100%' }}>
                      <div className="step-n">[ {f.n} ]</div>
                      <h3>{f.title}</h3>
                      <p>{f.text}</p>
                      <a href={f.to}>{f.link}</a>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section className="sec" style={{ paddingTop: 0 }} id="live">
            <div className="wrap">
              <Reveal>
                <div className="sec-head">
                  <p className="eyebrow">What is live</p>
                  <h2>Everything here is real and callable.</h2>
                  <p className="lead">Each row links to the thing itself, on {net.name}, not to a description of it.</p>
                </div>
              </Reveal>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Surface</th>
                      <th>Where</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Bond contract</td>
                      <td className="addr">
                        {fundTx ? (
                          <>
                            funding tx <TxLink txid={fundTx.txid} />
                          </>
                        ) : (
                          'P2SH32 · 3 spend paths · txid listed after the first bond on this network'
                        )}
                      </td>
                      <td>
                        <span className={`pill ${fundTx ? 'ok' : ''}`}>{fundTx ? 'live' : 'soon'}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>Web app</td>
                      <td className="addr">{location.host}</td>
                      <td>
                        <span className="pill ok">live</span>
                      </td>
                    </tr>
                    <tr>
                      <td>GitHub Action</td>
                      <td className="addr">
                        <a href={demoRepoUrl} target="_blank" rel="noreferrer">
                          github.com/{DEMO_REPO[0]}/{DEMO_REPO[1]}
                        </a>
                      </td>
                      <td>
                        <span className={`pill ${repoConfigured ? 'ok' : ''}`}>{repoConfigured ? 'live' : 'soon'}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>On-chain tests</td>
                      <td className="addr">
                        {SOURCE ? (
                          <a href={`${SOURCE}/blob/main/docs/proof/DEMO_TXIDS.md`} target="_blank" rel="noreferrer">
                            12 of 12 cases, real transactions
                          </a>
                        ) : (
                          '12 of 12 cases, real transactions'
                        )}
                      </td>
                      <td>
                        <span className="pill ok">12/12</span>
                      </td>
                    </tr>
                    <tr>
                      <td>WizardConnect</td>
                      <td className="addr">relay-based wallet signing, no backend</td>
                      <td>
                        <span className="pill ok">live</span>
                      </td>
                    </tr>
                    {proofs.slice(0, 4).map((p) => (
                      <tr key={p.txid + p.label}>
                        <td>{p.label}</td>
                        <td>
                          <TxLink txid={p.txid} />
                        </td>
                        <td>
                          <span className="pill ok">confirmed</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="wrap" id="try">
            <Reveal>
              <div className="cta">
                <p className="eyebrow">Try it</p>
                <h2>Put a price on spam.</h2>
                <p className="lead">Bond an issue in under two minutes and watch it come back.</p>
                <div className="actions">
                  <a className="btn" href={href('/bond', { issue: DEMO_ISSUE_URL })}>
                    Bond an issue
                  </a>
                  <a className="btn ghost" href={href('/judges')}>
                    Judges: start here
                  </a>
                </div>
              </div>
            </Reveal>
          </section>

          {TEAM.some((m) => m.name.trim()) && (
            <section className="sec" style={{ paddingTop: 0 }} id="team">
              <div className="wrap">
                <Reveal>
                  <div className="sec-head">
                    <p className="eyebrow">Who built this</p>
                    <h2>Built in three days.</h2>
                  </div>
                </Reveal>
                <div className="team">
                  {TEAM.filter((m) => m.name.trim()).map((m, i) => (
                    <Reveal key={i} delay={i * 0.06}>
                      <div className="member">
                        <PixelAvatar seed={m.name || `member-${i}`} />
                        <div>
                          <p className="step-n">{m.role}</p>
                          <h3>{m.name}</h3>
                          <p>
                            {m.github ? (
                              <a href={`https://github.com/${m.github}`} target="_blank" rel="noreferrer">
                                github.com/{m.github}
                              </a>
                            ) : (
                              <span className="todo">github handle goes here</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
