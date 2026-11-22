import { useEffect, useState, type MouseEvent } from 'react';
import { href } from '../lib/router';
import { goSection } from '../lib/scroll';
import { Logo } from './Logo';
import { Icon } from './icons';

const SOURCE = import.meta.env.VITE_BLAZE_SOURCE_URL?.trim();
const SECTIONS = [
  ['how', 'how_it_works'],
  ['contract', 'the_contract'],
  ['live', 'whats_live'],
] as const;

/**
 * Fixed bar under the banner. Transparent over the landing hero; after scrolling (or on any inner
 * page) it becomes a translucent blurred bar with a bottom rule. Mono snake_case links like the reference.
 */
export function Nav({ path }: { path: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const solid = scrolled || path !== '/';

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 80);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => setOpen(false), [path]);

  const jump = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    goSection(id, path === '/');
  };

  return (
    <header className={`nav ${solid ? 'scrolled' : ''}`} id="nav">
      <div className="wrap nav-in">
        <Logo />
        <button
          className="menu-btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <Icon.Close /> : <Icon.Menu />}
        </button>
        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={href('/')} onClick={jump(id)}>
              {label}
            </a>
          ))}
          <a href={href('/mybonds')} className={path === '/mybonds' ? 'current' : ''}>
            my_bonds
          </a>
          <a href={href('/judges')} className={path === '/judges' ? 'current' : ''}>
            judges
          </a>
          {SOURCE && (
            <a href={SOURCE} target="_blank" rel="noreferrer">
              github
            </a>
          )}
          <a href={href('/bond')} className="nav-cta">
            bond_an_issue
          </a>
        </nav>
      </div>
    </header>
  );
}
