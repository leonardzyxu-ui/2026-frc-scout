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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center border border-slate-800 shadow-inner">
            {isChecking ? (
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            ) : (
              <Lock className="w-8 h-8 text-blue-400" />
            )}
          </div>
        </div>

        <h2 className="text-2xl font-black text-center mb-2 tracking-tight">ADMIN ACCESS REQUIRED</h2>
        <p className="text-slate-400 text-center text-sm mb-8 font-medium">
          Admin access is verified with Firebase custom claims or an enabled admin role document for this signed-in device.
        </p>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm font-semibold text-slate-300">
          {message}
        </div>

        <button
          type="button"
          onClick={() => void checkAccess()}
          disabled={isChecking}
          className="mt-4 w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black tracking-wide shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="mr-2 inline h-5 w-5" />
          {isChecking ? 'CHECKING' : 'REFRESH ADMIN ACCESS'}
        </button>
      </div>
    </div>
  );
}
