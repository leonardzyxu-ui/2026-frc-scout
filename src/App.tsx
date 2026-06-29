import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
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
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <main className="relative min-h-screen overflow-hidden">
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
