import { useEffect, useRef } from 'react';

/**
 * Hero art: the "issue gate". Issues fly into the Bond contract; genuine ones are REFUNDED (green coin back to the
 * contributor), spam is sent to CHARITY (red coin the other way). Web Animations API only, no WebGL.
 * Pauses when the tab is hidden or the hero is off-screen, keeps at most MAX_CARDS cards in the DOM, and shows two
 * static cards for visitors who prefer reduced motion.
 */

interface Issue {
  num: string;
  title: string;
  real: boolean;
}

const ISSUES: Issue[] = [
  { num: '#142', title: 'Fix panic when the config file is empty', real: true },
  { num: '#143', title: 'CRITICAL: 0-day in every function!!', real: false },
  { num: '#144', title: 'Docs: typo in the install section', real: true },
  { num: '#145', title: 'Crash on startup when a proxy is set', real: true },
  { num: '#146', title: 'As an AI language model, I found…', real: false },
  { num: '#147', title: 'Add a --json flag to the list command', real: true },
];

const MAX_CARDS = 4;
const SPAWN_MS = 1500;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Build a GitHub-style issue card with its verdict stamp. */
function buildCard(issue: Issue): { card: HTMLElement; stamp: HTMLElement } {
  const card = el('div', 'gate-card');
  const top = el('div', 'gate-card-top');
  top.append(el('span', 'gate-num', issue.num));
  const title = el('div', 'gate-title', issue.title);
  const meta = el('div', 'gate-meta');
  meta.append(el('span', 'gate-chip', '0.0005 BCH'), el('span', 'gate-bonded', 'bonded ✓'));
  const stamp = el('div', issue.real ? 'gate-stamp ok' : 'gate-stamp bad', issue.real ? 'REFUNDED ✓' : '→ CHARITY');
  card.append(top, title, meta, stamp);
  return { card, stamp };
}

export function HeroGate() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = root.current;
    const stageEl = stage.current;
    const laneEl = lane.current;
    if (!rootEl || !stageEl || !laneEl) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- reduced motion: one refunded card and one charity card, no animation at all ----
    if (reduced) {
      for (const [i, issue] of [ISSUES[0], ISSUES[1]].entries()) {
        const { card } = buildCard(issue);
        card.classList.add('static');
        card.style.top = `calc(50% + ${i === 0 ? -56 : 56}px)`;
        laneEl.append(card);
      }
      return () => laneEl.replaceChildren();
    }

    let n = 0;
    let timer = 0;
    let visible = true;
    let tabVisible = !document.hidden;
    const running = () => visible && tabVisible;

    /** One issue's whole journey: fly in, stamp, coin out, card leaves, nodes removed. */
    const play = (issue: Issue, slot: number) => {
      const { card, stamp } = buildCard(issue);
      const y = [-100, 0, 100][slot % 3];
      card.style.top = `calc(50% + ${y}px)`;
      laneEl.append(card);
      const IN = 1000;
      card.animate(
        [
          { transform: 'translate3d(calc(var(--dock) - 170px), -50%, 0) scale(0.94)', opacity: 0 },
          { transform: 'translate3d(calc(var(--dock) - 30px), -50%, 0) scale(1)', opacity: 1, offset: 0.7 },
          { transform: 'translate3d(var(--dock), -50%, 0) scale(1)', opacity: 1 },
        ],
        { duration: IN, easing: EASE, fill: 'forwards' },
      );
      stamp.animate(
        [
          { transform: 'rotate(-14deg) scale(2.8)', opacity: 0 },
          { transform: 'rotate(-6deg) scale(0.9)', opacity: 1, offset: 0.6 },
          { transform: 'rotate(-8deg) scale(1)', opacity: 1 },
        ],
        { duration: 360, delay: IN, easing: EASE, fill: 'both' },
      );

      // the verdict lands: the rings glow, and a shockwave leaves the contract in the verdict's colour
      const tint = issue.real ? '10, 193, 142' : '229, 72, 77';
      const mark = rootEl.querySelector<HTMLElement>('.gate-box img');
      mark?.animate(
        [
          { transform: 'scale(1)', filter: 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.12))' },
          { transform: 'scale(1.12)', filter: `drop-shadow(0 0 26px rgba(${tint}, 0.95))`, offset: 0.35 },
          { transform: 'scale(1)', filter: 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.12))' },
        ],
        { duration: 650, delay: IN, easing: 'ease-out' },
      );
      const pulse = el('div', 'gate-pulse');
      pulse.style.borderColor = `rgb(${tint})`;
      laneEl.append(pulse);
      pulse
        .animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.85 },
            { transform: 'translate(-50%, -50%) scale(2.6)', opacity: 0 },
          ],
          { duration: 950, delay: IN, easing: 'ease-out', fill: 'both' },
        )
        .finished.then(
          () => pulse.remove(),
          () => {
            /* cancelled together with its node */
          },
        );

      // the coin leaves the gate: green back to the contributor (left), red to the charity (right)
      const coin = el('div', issue.real ? 'gate-coin ok' : 'gate-coin bad');
      coin.style.top = `calc(50% + ${y}px)`;
      laneEl.append(coin);
      const dir = issue.real ? -1 : 1;
      for (const [lag, alpha, size] of [
        [70, 0.5, 0.8],
        [140, 0.28, 0.6],
      ] as const) {
        const ghost = el('div', issue.real ? 'gate-coin ok' : 'gate-coin bad');
        ghost.style.top = `calc(50% + ${y}px)`;
        laneEl.append(ghost);
        ghost
          .animate(
            [
              { transform: 'translate3d(0, -50%, 0) scale(0.3)', opacity: 0 },
              { transform: `translate3d(0, -50%, 0) scale(${size})`, opacity: alpha, offset: 0.15 },
              { transform: `translate3d(${dir * 300}px, -50%, 0) scale(${size})`, opacity: alpha, offset: 0.85 },
              { transform: `translate3d(${dir * 330}px, -50%, 0) scale(0.4)`, opacity: 0 },
            ],
            { duration: 1300, delay: IN + 260 + lag, easing: 'ease-in-out', fill: 'both' },
          )
          .finished.then(
            () => ghost.remove(),
            () => {
              /* cancelled together with its node */
            },
          );
      }
      coin.animate(
        [
          { transform: 'translate3d(0, -50%, 0) scale(0.4)', opacity: 0 },
          { transform: 'translate3d(0, -50%, 0) scale(1)', opacity: 1, offset: 0.15 },
          { transform: `translate3d(${dir * 300}px, -50%, 0) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `translate3d(${dir * 330}px, -50%, 0) scale(0.6)`, opacity: 0 },
        ],
        { duration: 1300, delay: IN + 260, easing: 'ease-in-out', fill: 'both' },
      );

      const leave = card.animate(
        [
          { transform: 'translate3d(var(--dock), -50%, 0) scale(1)', opacity: 1 },
          { transform: 'translate3d(calc(var(--dock) + 40px), -50%, 0) scale(0.92)', opacity: 0 },
        ],
        { duration: 520, delay: IN + 1100, easing: 'ease-in', fill: 'forwards' },
      );
      leave.finished.then(
        () => {
          card.remove();
          coin.remove();
        },
        () => {
          /* cancelled together with its node */
        },
      );
    };

    const schedule = () => {
      if (!timer && running()) timer = window.setTimeout(spawn, SPAWN_MS);
    };
    const spawn = () => {
      timer = 0;
      if (running()) {
        // keep at most MAX_CARDS cards in the DOM (coins are removed together with their card)
        while (laneEl.querySelectorAll('.gate-card').length >= MAX_CARDS) {
          laneEl.querySelector('.gate-card')?.remove();
        }
        play(ISSUES[n % ISSUES.length], n);
        n += 1;
      }
      schedule();
    };

    const refresh = () => {
      const paused = !running();
      for (const a of laneEl.getAnimations({ subtree: true })) {
        if (paused) a.pause();
        else a.play();
      }
      if (paused) {
        window.clearTimeout(timer);
        timer = 0;
      } else {
        schedule();
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      refresh();
    });
    io.observe(rootEl);
    const onVis = () => {
      tabVisible = !document.hidden;
      refresh();
    };
    document.addEventListener('visibilitychange', onVis);

    // ---- desktop mouse parallax: the whole stage tilts slightly toward the pointer ----
    const hover = window.matchMedia('(hover: hover) and (min-width: 900px)').matches;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      stageEl.style.transform = `rotateX(${14 - dy * 9}deg) rotateY(${-16 + dx * 12}deg)`;
    };
    if (hover) window.addEventListener('pointermove', onMove, { passive: true });

    schedule();
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      laneEl.replaceChildren();
    };
  }, []);

  return (
    <div className="gate" ref={root} aria-hidden="true">
      <div className="gate-stage" ref={stage}>
        <div className="gate-box">
          <span className="gate-ring" />
          <img src={`${import.meta.env.BASE_URL}brand/bond-mark-light.svg`} alt="" width={124} height={124} />
        </div>
        <div className="gate-lane" ref={lane} />
      </div>
      <p className="gate-legend">
        <span className="dot ok" /> refund → you <span className="dot bad" /> forfeit → charity
      </p>
    </div>
  );
}
