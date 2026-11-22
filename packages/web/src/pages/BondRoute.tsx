import { WalletProvider } from '../lib/walletContext';
import { BondPage } from './BondPage';

/** The WizardConnect stack is only loaded (and its provider only mounted) on the bond page. */
export default function BondRoute({ params }: { params: URLSearchParams }) {
  return (
    <WalletProvider>
      <BondPage params={params} />
    </WalletProvider>
  );
}
