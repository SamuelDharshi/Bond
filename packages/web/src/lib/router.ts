import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, q] = h.split('?');
  return { path: path || '/', params: new URLSearchParams(q ?? '') };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const href = (path: string, params?: Record<string, string>) =>
  `#${path}${params ? `?${new URLSearchParams(params).toString()}` : ''}`;

export const go = (path: string, params?: Record<string, string>) => {
  location.hash = href(path, params);
};
