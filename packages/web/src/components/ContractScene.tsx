import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { href } from '../lib/router';

const Scene3D = lazy(() => import('./Scene3D'));

/** 3D only where it helps: skip on small screens, low-power devices, reduced motion and no WebGL. */
function canRender3D(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.innerWidth < 760) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const OUTS = [
  ['refund()', 'maintainer signs, the deposit goes back to you'],
  ['forfeit()', 'maintainer signs, the deposit goes to the charity'],
  ['reclaim()', 'no signature, after the timeout, back to you'],
] as const;

/** Static ink poster: the same story as the 3D scene, for phones, low-power devices and no-WebGL. */
function ScenePoster() {
  return (
    <svg
      className="scene-poster"
      viewBox="0 0 520 420"
      role="img"
      aria-label="A coin enters the Bond seal and leaves by one of three paths"
    >
      <g fill="none" stroke="#111" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M232 92v-14a28 28 0 0 1 56 0v14" />
        <circle cx="260" cy="150" r="64" />
        <circle cx="260" cy="150" r="28" stroke="#0ac18e" />
        <path d="M232 214 120 330M260 214v96M288 214l112 116" strokeDasharray="3 9" />
        {[120, 260, 400].map((x, i) => (
          <circle key={x} cx={x} cy={i === 1 ? 336 : 340} r="22" />
        ))}
      </g>
      <g fontFamily="var(--mono)" fontSize="13" fill="#111" textAnchor="middle">
        <text x="120" y="392">
          Refund
        </text>
        <text x="260" y="392">
          Forfeit to charity
        </text>
        <text x="400" y="392">
          Reclaim
        </text>
      </g>
    </svg>
  );
}

/** "the_contract": a coin drops into the seal, then splits along the three real spend paths as you scroll. */
export function ContractScene() {
  const sec = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [mode] = useState(() => (canRender3D() ? '3d' : 'static'));
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);
  const [caption, setCaption] = useState(0);

  useEffect(() => {
    if (mode !== '3d') return;
    const el = sec.current;
    if (!el) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      progress.current = p;
      setCaption((c) => {
        const n = p < 0.3 ? 0 : p < 0.8 ? 1 : 2;
        return n === c ? c : n;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '200px' });
    io.observe(el);
    // start downloading the 3D bundle shortly before the section comes into view, not at page load
    const preload = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '900px' });
    preload.observe(el);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      io.disconnect();
      preload.disconnect();
    };
  }, [mode]);

  const captions = [
    'Your deposit drops into a contract made for one issue.',
    'From there it can leave by only three paths.',
    'Nothing else is accepted. Not even from the maintainer.',
  ];

  return (
    <section id="contract" ref={sec} className={`scene-sec ${mode === '3d' ? 'pinned' : ''}`}>
      <div className="scene-sticky">
        <div className="wrap scene-grid">
          <div className="scene-copy">
            <p className="eyebrow">The contract</p>
            <h2>Three ways out.</h2>
            <p className="lead scene-caption">{mode === '3d' ? captions[caption] : captions[1]}</p>
            <ul className="scene-outs">
              {OUTS.map(([fn, text]) => (
                <li key={fn}>
                  <code>{fn}</code>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <p className="note">
              <a href={href('/how')}>Read the contract →</a>
            </p>
          </div>
          <div className="scene-stage">
            {mode === '3d' && near ? (
              <Suspense fallback={<ScenePoster />}>
                <Scene3D progress={progress} active={active} />
              </Suspense>
            ) : (
              <ScenePoster />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
