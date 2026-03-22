import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SetupView() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col p-6 space-y-6 overflow-y-auto h-full pb-12 items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
          REBUILT
        </h1>
        <p className="text-xs font-bold text-gray-500 tracking-[0.5em] uppercase mt-2">Scout System</p>
      </div>

      <div className="w-full max-w-md space-y-6">
        <button 
          onClick={() => navigate('/scout')}
          className="w-full py-12 bg-blue-900/30 border-2 border-blue-800/50 rounded-3xl text-3xl font-black shadow-lg active:scale-95 text-blue-300 transition-all hover:bg-blue-900/50 uppercase tracking-widest"
        >
          Match Scout
        </button>

        <button 
          onClick={() => navigate('/pit')}
          className="w-full py-12 bg-emerald-900/30 border-2 border-emerald-800/50 rounded-3xl text-3xl font-black shadow-lg active:scale-95 text-emerald-300 transition-all hover:bg-emerald-900/50 uppercase tracking-widest"
        >
          Pit Scout
        </button>

        <button 
          onClick={() => navigate('/history')}
          className="w-full py-12 bg-purple-900/30 border-2 border-purple-800/50 rounded-3xl text-3xl font-black shadow-lg active:scale-95 text-purple-300 transition-all hover:bg-purple-900/50 uppercase tracking-widest"
        >
          My Device History
        </button>
      </div>

      <button 
        onClick={() => navigate('/admin')}
        className="mt-12 text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
      >
        [ Admin Access ]
      </button>
    </div>
  );
}
