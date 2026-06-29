import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Download, FileJson, History, Search, Send, Settings, Wrench, X } from 'lucide-react';
import {
  buildScoutArchiveBundle,
  getScoutArchiveIdentity,
  listScoutArchiveRecords,
  renameScoutArchiveIdentity,
  setScoutArchiveIdentity,
  type ScoutArchiveIdentity
} from '../utils/scoutArchive';
import { verifyScoutIdentityUnlockPassphrase } from '../utils/scoutIdentityLock';

type SetupStage = 'loading' | 'passphrase' | 'identity' | 'home';

const panelClass =
  'group flex w-full items-center justify-between border border-white/10 bg-white/[0.035] px-5 py-5 text-left transition-all hover:border-cyan-300/45 hover:bg-cyan-300/[0.08] active:scale-[0.99] sm:px-7 sm:py-6';

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const normalizeScoutNumberInput = (value: string) => value.replace(/[^\d]/g, '').slice(0, 2);

const parseScoutNumber = (value: string) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 99 ? number : null;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function SetupView() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<SetupStage>('loading');
  const [identity, setIdentity] = useState<ScoutArchiveIdentity>({ username: '', scoutNumber: null });
  const [passphrase, setPassphrase] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [numberDraft, setNumberDraft] = useState('');
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [recordSummary, setRecordSummary] = useState({ total: 0, unsynced: 0 });

  const greeting = useMemo(() => getGreeting(), []);

  const hydrate = async () => {
    try {
      const [storedIdentity, records] = await Promise.all([
        getScoutArchiveIdentity().catch(() => ({ username: '', scoutNumber: null })),
        listScoutArchiveRecords({ includeDeleted: true }).catch(() => [])
      ]);
      setIdentity(storedIdentity);
      setNameDraft(storedIdentity.username || '');
      setNumberDraft(storedIdentity.scoutNumber ? String(storedIdentity.scoutNumber) : '');
      setRecordSummary({
        total: records.length,
        unsynced: records.filter(record => record.syncStatus !== 'synced').length
      });
      setStage(storedIdentity.username && storedIdentity.scoutNumber ? 'home' : 'passphrase');
    } catch (hydrateError) {
      console.error('Unable to load scout setup state', hydrateError);
      setStage('passphrase');
    }
  };

  useEffect(() => {
    void hydrate();
  }, []);

  const handlePassphraseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const unlocked = await verifyScoutIdentityUnlockPassphrase(passphrase);
    if (!unlocked) {
      setError('Admin passphrase is incorrect.');
      return;
    }
    setError('');
    setPassphrase('');
    setStage('identity');
  };

  const handleIdentityConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextIdentity = {
      username: nameDraft.trim(),
      scoutNumber: parseScoutNumber(numberDraft)
    };
    if (!nextIdentity.username) {
      setError('Scout name is required.');
      return;
    }
    if (!nextIdentity.scoutNumber) {
      setError('Scout number must be 1 to 99.');
      return;
    }

    try {
      await setScoutArchiveIdentity(nextIdentity);
      setIdentity(nextIdentity);
      setError('');
      setStage('home');
      await hydrate();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to lock this scout identity.');
    }
  };

  const handleRenameConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextIdentity = {
      username: nameDraft.trim(),
      scoutNumber: parseScoutNumber(numberDraft)
    };
    if (!nextIdentity.username) {
      setError('Scout name is required.');
      return;
    }
    if (!nextIdentity.scoutNumber) {
      setError('Scout number must be 1 to 99.');
      return;
    }

    const unlocked = await verifyScoutIdentityUnlockPassphrase(passphrase);
    if (!unlocked) {
      setError('Admin passphrase is incorrect.');
      return;
    }

    try {
      await renameScoutArchiveIdentity(nextIdentity, 'unlock_passphrase');
      setIdentity(nextIdentity);
      setPassphrase('');
      setError('');
      setRenameOpen(false);
      await hydrate();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Unable to change this scout identity.');
    }
  };

  const handleDownloadAllHistory = async () => {
    if (!identity.username) {
      setExportStatus('Scout name is missing. Reopen setup before exporting.');
      return;
    }
    try {
      const bundle = await buildScoutArchiveBundle(identity.username);
      const filename = `${identity.username || 'scout'}_all_history_${new Date(bundle.exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
      downloadJson(filename, JSON.stringify(bundle, null, 2));
      setExportStatus(`Downloaded ${filename} to this computer with ${bundle.records.length} local history records. Schema: ${bundle.schema?.documentationPath || 'ScoutArchiveBundle v8'}.`);
      await hydrate();
    } catch (exportError) {
      console.error('Unable to export all scout history', exportError);
      setExportStatus('Unable to export JSON from this browser right now.');
    }
  };

  const openRename = () => {
    setRenameOpen(true);
    setExportOpen(false);
    setNameDraft(identity.username || '');
    setNumberDraft(identity.scoutNumber ? String(identity.scoutNumber) : '');
    setPassphrase('');
    setError('');
  };

  if (stage === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="text-sm font-black uppercase tracking-[0.26em] text-cyan-200">Loading PowerScout</div>
      </div>
    );
  }

  if (stage === 'passphrase') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <form onSubmit={handlePassphraseSubmit} className="w-full max-w-md">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Enter Admin Passphrase</h1>
          <input
            type="password"
            value={passphrase}
            onChange={event => setPassphrase(event.target.value)}
            className="mt-7 w-full border border-white/15 bg-white/[0.04] px-4 py-4 text-lg font-black text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300"
            autoFocus
            aria-label="Enter Admin Passphrase"
          />
          <p className="mt-4 text-sm font-semibold text-slate-400">Find Leo for initial device setup.</p>
          {error && <div className="mt-4 border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100">{error}</div>}
        </form>
      </div>
    );
  }

  if (stage === 'identity') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <form onSubmit={handleIdentityConfirm} className="w-full max-w-md">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Lock Scout Device</h1>
          <label className="mt-7 block">
            <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Scout Name</span>
            <input
              type="text"
              value={nameDraft}
              onChange={event => setNameDraft(event.target.value)}
              className="mt-2 w-full border border-white/15 bg-white/[0.04] px-4 py-4 text-lg font-black text-white outline-none transition-colors focus:border-cyan-300"
              autoFocus
            />
          </label>
          <label className="mt-5 block">
            <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Scout Number</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{1,2}"
              value={numberDraft}
              onChange={event => setNumberDraft(normalizeScoutNumberInput(event.target.value))}
              className="mt-2 w-full border border-white/15 bg-white/[0.04] px-4 py-4 text-lg font-black text-white outline-none transition-colors focus:border-cyan-300"
            />
          </label>
          {error && <div className="mt-4 border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100">{error}</div>}
          <button
            type="submit"
            className="mt-7 w-full border border-cyan-300/40 bg-cyan-300/15 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-cyan-50 transition-colors hover:bg-cyan-300/25"
          >
            Confirm
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-5 py-5 text-white sm:px-8">
      <button
        type="button"
        onClick={() => {
          setSettingsOpen(true);
          setRenameOpen(false);
          setExportOpen(false);
          setError('');
          setExportStatus('');
        }}
        className="fixed right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-slate-200 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
        aria-label="Open Settings"
      >
        <Settings className="h-5 w-5" />
      </button>

      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center py-16">
        <h1 className="pr-14 text-4xl font-black tracking-tight text-white sm:text-6xl">
          {greeting},{' '}
          <span className="bg-gradient-to-r from-cyan-100 via-sky-300 to-blue-400 bg-clip-text text-transparent">
            {identity.username || 'Scout'}
          </span>
          .
        </h1>

        <section className="mt-12 grid gap-4" aria-label="Scout lanes">
          <LanePanel
            title="Match Scout"
            detail="Live match evidence and shift timeline."
            icon={<ClipboardList className="h-5 w-5" />}
            onClick={() => navigate('/scout')}
          />
          <LanePanel
            title="Pit Scout"
            detail="Robot facts, mechanisms, and claim checks."
            icon={<Wrench className="h-5 w-5" />}
            onClick={() => navigate('/pit')}
          />
          <LanePanel
            title="Pre Scout"
            detail="Public research before the event gets loud."
            icon={<Search className="h-5 w-5" />}
            onClick={() => navigate('/pre')}
          />
        </section>
      </main>

      {settingsOpen && (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-slate-950 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Settings</div>
                <h2 className="mt-1 text-2xl font-black text-white">Scout Device</h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 hover:border-white/25 hover:text-white"
                aria-label="Close Settings"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <section className="mt-6 border border-white/10 bg-white/[0.035] p-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Scout Name</div>
              <div className="mt-1 text-xl font-black text-white">{identity.username || 'Not set'}</div>
              <div className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Scout Number</div>
              <div className="mt-1 text-xl font-black text-cyan-100">#{identity.scoutNumber ?? 'Not set'}</div>
            </section>

            <div className="mt-5 grid gap-3">
              <button type="button" onClick={() => navigate('/history')} className="flex items-center justify-between border border-violet-300/25 bg-violet-300/10 px-4 py-4 text-left font-black text-violet-50 hover:bg-violet-300/15">
                <span className="inline-flex items-center gap-2"><History className="h-5 w-5" /> Scout History</span>
              </button>
              <button type="button" onClick={() => setExportOpen(value => !value)} className="flex items-center justify-between border border-cyan-300/25 bg-cyan-300/10 px-4 py-4 text-left font-black text-cyan-50 hover:bg-cyan-300/15">
                <span className="inline-flex items-center gap-2"><Download className="h-5 w-5" /> Export All Scout History</span>
              </button>
              <button type="button" onClick={openRename} className="border border-white/10 bg-white/[0.035] px-4 py-4 text-left font-black text-slate-100 hover:bg-white/[0.06]">
                Change Scout Name / Number
              </button>
            </div>

            {exportOpen && (
              <section className="mt-5 border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                <div className="text-sm font-black text-white">Export options</div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-cyan-50/75">
                  This downloads a `.json` file directly to this computer. It includes every local record this browser still has, including old versions, conflicts, tombstones, unsynced rows, and schema metadata for Admin import.
                </p>
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={() => void handleDownloadAllHistory()} className="inline-flex items-center justify-center gap-2 border border-cyan-300/35 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-50 hover:bg-cyan-300/25">
                    <FileJson className="h-4 w-4" /> Export big JSON
                  </button>
                  <button type="button" disabled className="inline-flex cursor-not-allowed items-center justify-center gap-2 border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-black text-slate-500">
                    <Send className="h-4 w-4" /> Send all to Leo
                  </button>
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-400">
                  Local records: {recordSummary.total}. Unsynced or pending: {recordSummary.unsynced}.
                </div>
                {exportStatus && <div className="mt-3 border border-white/10 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-50">{exportStatus}</div>}
              </section>
            )}

            {renameOpen && (
              <form onSubmit={handleRenameConfirm} className="mt-5 border border-white/10 bg-white/[0.035] p-4">
                <div className="text-sm font-black text-white">Admin rename required</div>
                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Scout Name</span>
                  <input value={nameDraft} onChange={event => setNameDraft(event.target.value)} className="mt-2 w-full border border-white/10 bg-slate-950 px-3 py-3 font-black text-white outline-none focus:border-cyan-300" />
                </label>
                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Scout Number</span>
                  <input value={numberDraft} onChange={event => setNumberDraft(normalizeScoutNumberInput(event.target.value))} inputMode="numeric" className="mt-2 w-full border border-white/10 bg-slate-950 px-3 py-3 font-black text-white outline-none focus:border-cyan-300" />
                </label>
                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Admin Passphrase</span>
                  <input type="password" value={passphrase} onChange={event => setPassphrase(event.target.value)} className="mt-2 w-full border border-white/10 bg-slate-950 px-3 py-3 font-black text-white outline-none focus:border-cyan-300" />
                </label>
                {error && <div className="mt-4 border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-100">{error}</div>}
                <button type="submit" className="mt-4 w-full border border-cyan-300/35 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-50 hover:bg-cyan-300/25">
                  Confirm Identity Change
                </button>
              </form>
            )}

            <section className="mt-5 border border-white/10 bg-white/[0.025] p-4">
              <div className="text-sm font-black text-white">Version sync rule</div>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">
                When a match is edited, the newest version number wins in either direction, but every older version is preserved for audit.
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function LanePanel({
  title,
  detail,
  icon,
  onClick
}: {
  title: string;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={panelClass}>
      <span className="flex min-w-0 items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-2xl font-black text-white">{title}</span>
          <span className="mt-1 block text-sm font-semibold text-slate-400">{detail}</span>
        </span>
      </span>
      <span className="text-2xl font-black text-cyan-100 transition-transform group-hover:translate-x-1">→</span>
    </button>
  );
}
