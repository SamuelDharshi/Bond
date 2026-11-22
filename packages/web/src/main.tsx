import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initNetworkChoice } from './lib/network';
import { prepareIntro } from './lib/intro';
import './theme.css';
import './styles.css';

// Must run before anything reads the active network: applies a saved "Practice on testnet" choice.
initNetworkChoice();
// Marks <html> so the landing intro starts from the right frame (no flash).
prepareIntro();

const { App } = await import('./App');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
