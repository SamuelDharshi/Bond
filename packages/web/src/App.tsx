import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { finishIntro } from './lib/intro';
import { useRoute } from './lib/router';
import { BchLoader, shouldShowLoader } from './components/BchLoader';
import { BlazeBanner } from './components/BlazeBanner';
import { Footer } from './components/Footer';
import { Nav } from './components/Nav';
import { Home } from './pages/Home';

const BondPage = lazy(() => import('./pages/BondRoute'));
const StatusPage = lazy(() => import('./pages/StatusPage').then((m) => ({ default: m.StatusPage })));
const MaintainerPage = lazy(() => import('./pages/MaintainerPage').then((m) => ({ default: m.MaintainerPage })));
const DeckPage = lazy(() => import('./pages/DeckPage').then((m) => ({ default: m.DeckPage })));
const MyBondsPage = lazy(() => import('./pages/MyBondsPage').then((m) => ({ default: m.MyBondsPage })));
const HowPage = lazy(() => import('./pages/HowPage').then((m) => ({ default: m.HowPage })));
const JudgesPage = lazy(() => import('./pages/JudgesPage').then((m) => ({ default: m.JudgesPage })));

export function App() {
  const route = useRoute();
  const [loading, setLoading] = useState(shouldShowLoader);
  const loaded = useCallback(() => setLoading(false), []);

  // Leaving the landing page mid-intro must not leave the bar hidden.
  useEffect(() => {
    if (route.path !== '/') finishIntro();
  }, [route.path]);

  const page =
    route.path === '/bond' ? (
      <BondPage params={route.params} />
    ) : route.path === '/status' ? (
      <StatusPage params={route.params} />
    ) : route.path === '/maintainer' ? (
      <MaintainerPage params={route.params} />
    ) : route.path === '/mybonds' ? (
      <MyBondsPage />
    ) : route.path === '/how' ? (
      <HowPage />
    ) : route.path === '/judges' ? (
      <JudgesPage />
    ) : null;

  if (route.path === '/deck') {
    return (
      <Suspense fallback={null}>
        <DeckPage />
      </Suspense>
    );
  }

  return (
    <>
      {loading && <BchLoader onDone={loaded} />}
      <BlazeBanner />
      <Nav path={route.path} />
      {page ? (
        <motion.main
          key={route.path}
          className="page"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="wrap">
            <Suspense fallback={<p className="muted">Loading…</p>}>{page}</Suspense>
          </div>
        </motion.main>
      ) : (
        <main>
          <Home />
        </main>
      )}
      <Footer />
    </>
  );
}
