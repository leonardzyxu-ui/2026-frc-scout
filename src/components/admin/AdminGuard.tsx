import React, { useEffect, useState } from 'react';
import { Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { getAdminAccessState } from '../../utils/adminAuth';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState('Checking Firebase admin role...');

  const checkAccess = async () => {
    setIsChecking(true);
    const state = await getAdminAccessState();
    setIsUnlocked(state.isAdmin);
    setMessage(state.message);
    setIsChecking(false);
  };

  useEffect(() => {
    void checkAccess();
  }, []);

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-white">
      <div className="admin-g2-lg relative w-full max-w-md overflow-hidden border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="mb-6 flex justify-center">
          <div className="admin-g2 flex h-16 w-16 items-center justify-center border border-slate-800 bg-slate-950 shadow-inner">
            {isChecking ? (
              <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            ) : (
              <Lock className="h-8 w-8 text-blue-400" />
            )}
          </div>
        </div>

        <h2 className="mb-2 text-center text-2xl font-black tracking-tight">ADMIN ACCESS REQUIRED</h2>
        <p className="mb-8 text-center text-sm font-medium text-slate-400">
          Admin access is verified with Firebase custom claims or an enabled admin role document for this signed-in device.
        </p>

        <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-sm font-semibold text-slate-300">
          {message}
        </div>

        <button
          type="button"
          onClick={() => void checkAccess()}
          disabled={isChecking}
          className="admin-g2-sm mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-4 font-black tracking-wide text-white shadow-lg shadow-blue-900/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="mr-2 inline h-5 w-5" />
          {isChecking ? 'CHECKING' : 'REFRESH ADMIN ACCESS'}
        </button>
      </div>
    </div>
  );
}
