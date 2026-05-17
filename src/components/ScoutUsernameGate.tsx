import React from 'react';

export default function ScoutUsernameGate({
  pendingUsername,
  setPendingUsername,
  onSave
}: {
  pendingUsername: string;
  setPendingUsername: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-2xl font-black text-white">Set Your Scout Username</h2>
        <p className="mt-3 text-sm text-slate-400">
          We use this username for the local JSON archive on this device. It stays remembered in IndexedDB and lets us export your scouting history cleanly.
        </p>
        <div className="mt-5 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
            Scout Username
          </label>
          <input
            type="text"
            value={pendingUsername}
            onChange={(event) => setPendingUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSave();
              }
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
            placeholder="Required"
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          className="mt-6 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-400"
        >
          Save Username
        </button>
      </div>
    </div>
  );
}
