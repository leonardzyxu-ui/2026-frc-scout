import React from 'react';
import { Database, ShieldCheck, UserCheck } from 'lucide-react';

export default function ScoutUsernameGate({
  pendingUsername,
  setPendingUsername,
  onSave
}: {
  pendingUsername: string;
  setPendingUsername: (value: string) => void;
  onSave: () => void;
}) {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <form onSubmit={handleSubmit} className="admin-g2-lg w-full max-w-3xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl shadow-slate-950">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-6 md:p-7">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              <UserCheck className="h-4 w-4" />
              Scout Identity
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Who is collecting this evidence?</h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-slate-400">
              This is not an account login. It labels this device's scout rows so Admin V4 can audit coverage, resolve sync conflicts, and understand how much local evidence supports PPA.
            </p>

            <div className="mt-6 space-y-2">
              <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Scout Username
              </label>
              <input
                type="text"
                value={pendingUsername}
                onChange={(event) => setPendingUsername(event.target.value)}
                className="admin-g2-sm w-full border border-slate-700 bg-slate-900 px-4 py-3 text-base font-black text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400"
                placeholder="Your scout name"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="admin-g2-sm mt-6 inline-flex w-full items-center justify-center gap-2 border border-cyan-400/40 bg-cyan-500/20 px-4 py-3 text-sm font-black text-cyan-50 transition-colors hover:bg-cyan-500/30"
            >
              <ShieldCheck className="h-4 w-4" />
              Attach Name To This Device
            </button>
          </div>

          <div className="border-t border-slate-800 bg-slate-900/70 p-5 lg:border-l lg:border-t-0">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Used For</div>
            <div className="mt-4 space-y-3">
              {[
                {
                  title: 'Evidence Ledger',
                  detail: 'Every local row can be traced to the scout and device that created it.',
                  icon: <Database className="h-4 w-4" />
                },
                {
                  title: 'Sync Review',
                  detail: 'Conflicts are easier to resolve when the source scout is visible.',
                  icon: <ShieldCheck className="h-4 w-4" />
                },
                {
                  title: 'PPA Confidence',
                  detail: 'Coverage and reliability context help PPA read a team as a range, not just a number.',
                  icon: <UserCheck className="h-4 w-4" />
                }
              ].map(item => (
                <div key={item.title} className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <span className="text-cyan-200">{item.icon}</span>
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
