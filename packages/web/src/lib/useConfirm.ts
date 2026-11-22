import { useEffect, useState } from 'react';
import { getChain } from './chain';

/** Polls the network (every few seconds) until the transaction has at least one confirmation. */
export function useConfirmations(txid?: string): number {
  const [conf, setConf] = useState(0);
  useEffect(() => {
    setConf(0);
    if (!txid) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const v = (await getChain().request('blockchain.transaction.get', txid, true)) as { confirmations?: number };
        const c = v.confirmations ?? 0;
        if (alive) setConf(c);
        if (c >= 1) return;
      } catch {
        /* transient: keep polling */
      }
      if (alive) timer = setTimeout(poll, 6000);
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [txid]);
  return conf;
}
