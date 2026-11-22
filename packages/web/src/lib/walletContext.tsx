import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWizardConnect, type UseWizardConnectResult } from '@wizardconnect/react';

/** Primary + fallback Nostr relays (env-configurable). Defaults are WizardConnect's own defaults. */
const RELAYS = [
  import.meta.env.VITE_WIZ_RELAY_PRIMARY || 'wss://relay.riften.net:443',
  import.meta.env.VITE_WIZ_RELAY_FALLBACK || 'wss://relay.cauldron.quest:443',
];

/** If pairing hasn't completed in this long, show a relay-timeout message with retry. */
const PAIRING_TIMEOUT_MS = 3 * 60 * 1000;

interface WalletCtx extends UseWizardConnectResult {
  timedOut: boolean;
  retry: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wc = useWizardConnect({
    dappName: 'Bond',
    dappIcon: `${location.origin}${import.meta.env.BASE_URL}brand/bond-icon.svg`,
    relayUrls: RELAYS,
    sessionKey: 'bond-wizardconnect-session',
  });
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(timer.current);
    if (wc.state === 'connecting') {
      setTimedOut(false);
      timer.current = setTimeout(() => setTimedOut(true), PAIRING_TIMEOUT_MS);
    }
    return () => clearTimeout(timer.current);
  }, [wc.state]);
  const retry = () => {
    setTimedOut(false);
    void wc.disconnect().finally(() => wc.connect());
  };
  return <Ctx.Provider value={{ ...wc, timedOut, retry }}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet outside WalletProvider');
  return v;
}
