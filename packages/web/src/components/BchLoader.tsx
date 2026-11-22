import { useEffect, useRef, useState } from 'react';
import { BCH_COIN } from '../lib/bchCoin';
import { accelerateIntro } from '../lib/intro';

const TOTAL_MS = 2100;
const base = import.meta.env.BASE_URL;

/** Plays on every full page load (refresh or new visit); click to skip. */
export function shouldShowLoader(): boolean {
  return true;
}

/**
 * Loading screen (~2 s): the official Bitcoin Cash coin drops in, inks itself on (stroke draw) and fills green,
 * then spins once and lands on its BACK face, which carries the Bond mark. The coin then gives way to the full
 * Bond logo, which fades in before the page reveals. The BCH geometry is used exactly as published.
 * Click to skip. Reduced motion gets a plain fade of the logo.
 */
export function BchLoader({ onDone }: { onDone: () => void }) {
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [out, setOut] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const t = setTimeout(finish, reduced ? 900 : TOTAL_MS);
    return () => clearTimeout(t);
  }, []);

  const skip = () => {
    if (out) return;
    setOut(true);
    accelerateIntro();
    setTimeout(finish, 220);
  };

  const { cx, cy, r, bPath, green, viewBox } = BCH_COIN;
  return (
    <div
      className={`bchload ${reduced ? 'reduced' : 'play'} ${out ? 'skipping' : ''}`}
      onClick={skip}
      role="status"
      aria-label="Loading Bond. Click to skip."
    >
      <div className="bchload-stage">
        <div className="coinwrap">
          <div className="coin">
            <div className="face front">
              <svg className="bch-coin" viewBox={viewBox} aria-hidden="true">
                <circle className="bc-fill" cx={cx} cy={cy} r={r} fill={green} />
                <path className="bc-b-fill" d={bPath} fill="#fff" />
                <circle className="bc-ring" cx={cx} cy={cy} r={r - 5} pathLength={1} />
                <path className="bc-b-stroke" d={bPath} pathLength={1} />
              </svg>
            </div>
            <div className="face back">
              <img src={`${base}brand/bond-mark.svg`} alt="" width={96} height={96} />
            </div>
          </div>
        </div>
        <img className="bond-logo" src={`${base}brand/bond-logo-dark.svg`} alt="bond" width={248} height={60} />
      </div>
      <p className="bchload-hint">click to skip</p>
    </div>
  );
}
