import React, { useEffect, useState } from 'react';
import { Clipboard, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { AdminAccessState, getAdminAccessState } from '../../utils/adminAuth';
import { loadAdminV4Settings } from '../../utils/adminV4Settings';
import { getStoredEventKey } from '../../utils/sharedEventState';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState('Checking admin access for this signed-in device...');
  const [accessState, setAccessState] = useState<AdminAccessState | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [requestContext, setRequestContext] = useState({ eventKey: '', ownTeamNumber: '' });

  const checkAccess = async () => {
    setIsChecking(true);
    const state = await getAdminAccessState();
    setIsUnlocked(state.isAdmin);
    setMessage(state.message);
    setAccessState(state);
    setIsChecking(false);
  };

  useEffect(() => {
    void checkAccess();
    const settings = loadAdminV4Settings();
    setRequestContext({
      eventKey: getStoredEventKey(),
      ownTeamNumber: settings.ownTeamNumber
    });
  }, []);

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-white">
      <div className="admin-g2-lg relative w-full max-w-md overflow-hidden border border-slate-800 bg-slate-900 p-8 shadow-md shadow-slate-950/30">
        <div className="absolute left-0 top-0 h-1 w-full bg-blue-500" />

        <div className="mb-6 flex justify-center">
          <div className="admin-g2 flex h-16 w-16 items-center justify-center border border-slate-800 bg-slate-950 shadow-inner">
            {isChecking ? (
              <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            ) : (
              <Lock className="h-8 w-8 text-blue-400" />
            )}
          </div>
        </div>

        <h2 className="mb-2 text-center text-2xl font-black tracking-tight">Admin Access Needed</h2>
        <p className="mb-6 text-center text-sm font-medium leading-relaxed text-slate-400">
          This device is signed in, but this admin area needs an enabled admin role before it can show team strategy, backups, or sync controls.
        </p>

        <div className="space-y-3">
          <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-sm font-semibold text-slate-300">
            <div className="font-black text-white">What happened</div>
            <div className="mt-1">{message}</div>
            {accessState?.isAnonymous && (
              <div className="mt-2 text-xs text-slate-500">This appears to be an anonymous Firebase session for this browser/device.</div>
            )}
          </div>
          <details className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            <summary className="cursor-pointer font-black text-slate-200">Show access request details</summary>
            <div className="mt-3 space-y-2">
              <div>Ask an existing Firebase/admin owner to create or enable this document:</div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-900 p-3 text-xs font-semibold text-slate-300">
                <div>Event: <span className="font-black text-cyan-100">{requestContext.eventKey || 'unknown'}</span></div>
                <div>Own team: <span className="font-black text-cyan-100">{requestContext.ownTeamNumber || 'not set'}</span></div>
              </div>
              <code className="block break-all admin-g2-sm border border-slate-800 bg-slate-900 p-3 text-xs text-cyan-100">
                adminRoles/{accessState?.uid || 'current-user-uid'} {'{ enabled: true }'}
              </code>
              <button
                type="button"
                onClick={() => {
                  const request = [
                    'Please grant Admin V4 access for scout-rebuilt-2026.',
                    `Event: ${requestContext.eventKey || 'unknown'}`,
                    `Own team: ${requestContext.ownTeamNumber || 'not set'}`,
                    `UID: ${accessState?.uid || 'unknown'}`,
                    `Create/enable Firestore document: adminRoles/${accessState?.uid || 'unknown'} with enabled=true.`
                  ].join('\n');
                  if (!navigator.clipboard) {
                    setCopyStatus('Clipboard is unavailable. Select the text above instead.');
                    return;
                  }
                  void navigator.clipboard.writeText(request)
                    .then(() => setCopyStatus('Access request copied.'))
                    .catch(() => setCopyStatus('Copy failed. Select the text above instead.'));
                }}
                className="admin-g2-sm inline-flex items-center gap-2 border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-xs font-black text-cyan-50 hover:bg-cyan-500/25"
              >
                <Clipboard className="h-4 w-4" />Copy Access Request
              </button>
              {copyStatus && <div className="text-xs font-semibold text-cyan-100">{copyStatus}</div>}
            </div>
          </details>
        </div>

        <button
          type="button"
          onClick={() => void checkAccess()}
          disabled={isChecking}
          className="admin-g2-sm mt-4 w-full border border-blue-400/40 bg-blue-600 py-4 font-black tracking-wide text-white transition-all hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="mr-2 inline h-5 w-5" />
          {isChecking ? 'Checking Access' : 'Check Access Again'}
        </button>
      </div>
    </div>
  );
}
