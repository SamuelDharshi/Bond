import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

/** Deploy base, e.g. "" on a domain root or "/Bond" on GitHub Pages. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function parse(): Route {
  // Old "#/path" links keep working: rewrite them to the clean path once.
  if (location.hash.startsWith('#/')) {
    history.replaceState(null, '', BASE + location.hash.slice(1));
  }
  const p = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
  return { path: p.replace(/\/+$/, '') || '/', params: new URLSearchParams(location.search) };
}

/** True when the current URL is the landing page (used before React mounts). */
export const isHomePath = () => parse().path === '/';

export const href = (path: string, params?: Record<string, string>) =>
  `${BASE}${path}${params ? `?${new URLSearchParams(params).toString()}` : ''}`;

const NAV_EVENT = 'bond:navigate';

export const go = (path: string, params?: Record<string, string>) => {
  history.pushState(null, '', href(path, params));
  window.dispatchEvent(new Event(NAV_EVENT));
};

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const update = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    // Internal links navigate without a page reload.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(BASE || '/')) return;
      e.preventDefault();
      history.pushState(null, '', url.pathname + url.search);
      update();
    };
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV_EVENT, update);
      document.removeEventListener('click', onClick);
    };
  }, []);
  return r;
}
