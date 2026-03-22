import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ScoutProvider } from './context/ScoutContext';
import { LocalFileProvider } from './context/LocalFileContext';

// V2 Components
import SetupView from './views/SetupView';
import MatchScoutView from './views/MatchScoutView';
import PitScoutView from './views/PitScoutView';
import HistoryView from './views/HistoryView';
import AdminMainframeView from './views/AdminMainframeView';
import AdminGuard from './components/admin/AdminGuard';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';

  useEffect(() => {
    if (isLocalMode) {
      setIsAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, [isLocalMode]);

  if (!isAuthReady) {
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
            <Route path="/admin" element={<AdminGuard><AdminMainframeView /></AdminGuard>} />
            
            {/* Scout Routes - With Header */}
            <Route path="/*" element={
              <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
                  <div className="font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                    REBUILT Scout {isLocalMode && <span className="text-sm text-red-500 ml-2">(LOCAL)</span>}
                  </div>
                  <div className="text-xs font-mono text-green-400">System Ready</div>
                </header>
                <main className="flex-1 relative overflow-hidden">
                  <Routes>
                    <Route path="/" element={<SetupView />} />
                    <Route path="/scout" element={<MatchScoutView />} />
                    <Route path="/pit" element={<PitScoutView />} />
                    <Route path="/history" element={<HistoryView />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            } />
          </Routes>
        </Router>
      </ScoutProvider>
    </LocalFileProvider>
  );
}



