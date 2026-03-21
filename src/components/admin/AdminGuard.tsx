import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

const ADMIN_HASH = "f51017681489feaa432c4f86ceb66aae7bf383ed137b75ae9eeeea61e616af02";

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('admin_unlocked') === 'true') {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hash = await sha256(password);
    if (hash === ADMIN_HASH) {
      localStorage.setItem('admin_unlocked', 'true');
      setIsUnlocked(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center border border-slate-800 shadow-inner">
            <Lock className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-black text-center mb-2 tracking-tight">RESTRICTED ACCESS</h2>
        <p className="text-slate-500 text-center text-sm mb-8 font-medium">Please enter the mainframe password to continue.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={`w-full bg-slate-950 border rounded-xl p-4 text-center tracking-widest text-lg focus:outline-none transition-all ${
                error 
                  ? 'border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                  : 'border-slate-800 focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)]'
              }`}
              autoFocus
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black tracking-wide shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            ACCESS MAINFRAME
          </button>
        </form>
      </div>
    </div>
  );
}
