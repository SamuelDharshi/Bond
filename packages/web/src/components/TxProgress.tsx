import { TxLink } from './ui';
import { Icon } from './icons';
import { useConfirmations } from '../lib/useConfirm';

export type TxPhase = 'signing' | 'broadcast' | 'confirmed';
const ORDER: TxPhase[] = ['signing', 'broadcast', 'confirmed'];

/** Animated tx states: signing -> broadcast -> confirmed. Explorer links appear as soon as there is a txid. */
export function TxProgress({
  phase,
  txid,
  signLabel = 'Approve in your wallet',
}: {
  phase: TxPhase;
  txid?: string;
  signLabel?: string;
}) {
  const at = ORDER.indexOf(phase);
  const steps = [
    { key: 'signing', label: signLabel },
    { key: 'broadcast', label: 'Broadcast to the network' },
    { key: 'confirmed', label: 'Confirmed in a block' },
  ] as const;
  return (
    <ol className="txp" aria-label="Transaction progress" aria-live="polite">
      {steps.map((s, i) => {
        const state = phase === 'confirmed' || i < at ? 'done' : i === at ? 'active' : 'todo';
        return (
          <li key={s.key} className={`txp-step ${state}`}>
            <span className="txp-dot" aria-hidden="true">
              {state === 'done' ? <Icon.Check /> : state === 'active' ? <span className="spinner" /> : null}
            </span>
            <span className="txp-label">
              {s.label}
              {txid && i >= 1 && state !== 'todo' && (
                <>
                  {' '}
                  <TxLink txid={txid} />
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Convenience: given a txid, follows it from broadcast to confirmed. */
export function TxFollow({ txid }: { txid: string }) {
  const conf = useConfirmations(txid);
  return <TxProgress phase={conf >= 1 ? 'confirmed' : 'broadcast'} txid={txid} />;
}
