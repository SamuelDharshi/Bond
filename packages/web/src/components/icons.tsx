import type { ReactNode } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const Icon = {
  Lock: () => (
    <svg {...base}>
      <rect x="4" y="11" width="16" height="10" rx="3" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  Tag: () => (
    <svg {...base}>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </svg>
  ),
  Clock: () => (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Shield: () => (
    <svg {...base}>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Key: () => (
    <svg {...base}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M16 7l3 3" />
    </svg>
  ),
  Globe: () => (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  ),
  Heart: () => (
    <svg {...base}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  ),
  Wallet: () => (
    <svg {...base}>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M4 7l11-3v3M16 14h2" />
    </svg>
  ),
  Menu: () => (
    <svg {...base}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Close: () => (
    <svg {...base}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ),
  Arrow: () => (
    <svg {...base}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Check: () => (
    <svg {...base}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  ),
};

export function IconBox({ children }: { children: ReactNode }) {
  return <div className="icon-box">{children}</div>;
}
