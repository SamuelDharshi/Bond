import { useEffect, useState } from 'react';

/** Approximate BCH/USD for display only. Failure just hides the USD figure. */
let cached: Promise<number | undefined> | undefined;

function fetchPrice(): Promise<number | undefined> {
  cached ??= fetch('https://api.coinbase.com/v2/prices/BCH-USD/spot')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { data?: { amount?: string } }) => {
      const n = Number(j.data?.amount);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })
    .catch(() => undefined);
  return cached;
}

export function useBchUsd(): number | undefined {
  const [p, setP] = useState<number>();
  useEffect(() => {
    let alive = true;
    void fetchPrice().then((v) => alive && setP(v));
    return () => {
      alive = false;
    };
  }, []);
  return p;
}
