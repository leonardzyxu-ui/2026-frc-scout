import { BrowserRouter, HashRouter, NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ClipboardList, History, Home, Search, ShieldCheck, Wrench } from 'lucide-react';
import { auth, hasFirebaseServices } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ScoutProvider } from './context/ScoutContext';
import { LocalFileProvider } from './context/LocalFileContext';

import AdminGuard from './components/admin/AdminGuard';

const SetupView = lazy(() => import('./views/SetupView'));
const MatchScoutV4View = lazy(() => import('./views/MatchScoutV4View'));
const PitScoutView = lazy(() => import('./views/PitScoutView'));
const PreMatchView = lazy(() => import('./views/PreMatchView'));
const MatchDefenseScoutView = lazy(() => import('./views/MatchDefenseScoutView'));
const HistoryView = lazy(() => import('./views/HistoryView'));
const AdminMainframeView = lazy(() => import('./views/AdminMainframeView'));
const AdminV4View = lazy(() => import('./views/AdminV4View'));

function RouteLoading({ label = 'Loading workflow...' }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center bg-slate-950 text-white font-sans">
      <div className="admin-g2-sm border border-slate-800 bg-slate-900/75 px-5 py-4 text-sm font-black text-cyan-100 shadow-xl shadow-slate-950/30">
        {label}
      </div>
    </div>
  );
}

function ScoutShell({ isLocalMode }: { isLocalMode: boolean }) {
  const scoutRoutes = [
    { to: '/', label: 'Lanes', icon: <Home className="h-4 w-4" />, end: true },
    { to: '/pre', label: 'Pre Scout', icon: <Search className="h-4 w-4" /> },
    { to: '/pit', label: 'Pit Scout', icon: <Wrench className="h-4 w-4" /> },
    { to: '/scout', label: 'Match Scout', icon: <ClipboardList className="h-4 w-4" /> },
    { to: '/defense', label: 'Defense Scout', icon: <ShieldCheck className="h-4 w-4" /> },
    { to: '/history', label: 'My Evidence', icon: <History className="h-4 w-4" /> }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white font-sans">
      <header className="shrink-0 overflow-hidden border-b border-slate-800 bg-slate-950/95 px-4 py-3 shadow-xl shadow-slate-950/30 md:px-6">
        <div className="mx-auto flex min-w-0 max-w-7xl flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">PowerScout</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-xl font-black tracking-tight text-white md:text-2xl">Scouting Lanes</h1>
              {isLocalMode && (
                <span className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase text-amber-100">
                  Local
                </span>
              )}
            </div>
          </div>

          <nav className="admin-scrollbar-hidden -mx-1 flex min-w-0 max-w-full gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:pb-0" aria-label="Scout workflow">
            {scoutRoutes.map(route => (
              <NavLink
                key={route.to}
                to={route.to}
                end={route.end}
                className={({ isActive }) =>
                  `admin-g2-sm inline-flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-black transition-colors ${
                    isActive
                      ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-50'
                      : 'border-slate-800 bg-slate-900/75 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`
                }
              >
                {route.icon}
                {route.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<SetupView />} />
            <Route path="/pre" element={<PreMatchView />} />
            <Route path="/scout" element={<MatchScoutV4View />} />
            <Route path="/defense" element={<MatchDefenseScoutView />} />
            <Route path="/pit" element={<PitScoutView />} />
            <Route path="/history" element={<HistoryView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';
  const [isLocalRouteReady, setIsLocalRouteReady] = useState(!isLocalMode);

  useEffect(() => {
    if (isLocalMode || !hasFirebaseServices) {
      setIsAuthReady(true);
      return;
    }
    const fallbackTimer = window.setTimeout(() => {
      setIsAuthReady(true);
    }, 1500);
    const unsubscribe = onAuthStateChanged(auth, () => {
      // The scout workflow is local-first. Firebase auth being unavailable should
      // not block IndexedDB history, JSON export, or QR fallback.
      window.clearTimeout(fallbackTimer);
      setIsAuthReady(true);
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [isLocalMode]);

  useEffect(() => {
    if (!isLocalMode) return;
    const { pathname, search, hash } = window.location;
    const shouldBridgeDirectLocalRoute =
      !hash &&
      pathname !== '/' &&
      pathname !== '/index.html';

    if (shouldBridgeDirectLocalRoute) {
      window.history.replaceState(null, '', `/#${pathname}${search}`);
    }
    setIsLocalRouteReady(true);
  }, [isLocalMode]);

  if (!isAuthReady || !isLocalRouteReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-sans">
        <div className="animate-pulse text-xl font-bold text-blue-400">Connecting to Secure Database...</div>
      </div>
    );
  }

  const Router = isLocalMode ? HashRouter : BrowserRouter;

  return (
    <LocalFileProvider>
      <ScoutProvider>
        <Router>
          <Routes>
            {/* Admin Route - Protected */}
            <Route path="/admin" element={<Navigate to="/adminv4" replace />} />
            <Route path="/adminv4" element={<AdminGuard><Suspense fallback={<RouteLoading label="Loading Admin V4..." />}><AdminV4View /></Suspense></AdminGuard>} />
            <Route path="/adminv1" element={<AdminGuard><Suspense fallback={<RouteLoading label="Loading legacy admin..." />}><AdminMainframeView /></Suspense></AdminGuard>} />
            <Route path="/adminv2" element={<AdminGuard><Suspense fallback={<RouteLoading label="Loading Admin V2..." />}><AdminMainframeView initialTab="predictor" /></Suspense></AdminGuard>} />
            <Route path="/adminv2/prediction-vs-actual" element={<AdminGuard><Suspense fallback={<RouteLoading label="Loading Prediction vs Actual..." />}><AdminMainframeView initialTab="predictor" initialPredictorTab="comparison" /></Suspense></AdminGuard>} />
            
            {/* Scout Routes - With Header */}
            <Route path="/*" element={
              <ScoutShell isLocalMode={isLocalMode} />
            } />
          </Routes>
        </Router>
      </ScoutProvider>
    </LocalFileProvider>
  );
}
