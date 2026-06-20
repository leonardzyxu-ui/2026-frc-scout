import React from 'react';
import { ChevronLeft, Database, Download, RefreshCw, Upload } from 'lucide-react';
import { AdminV4AuditLogEntry } from '../../utils/adminV4LocalStore';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { AdminEmptyState, FocusHeader, SummaryCard } from './AdminV4UiAtoms';

const auditSeverityClass: Record<AdminV4AuditLogEntry['severity'], string> = {
  info: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  danger: 'border-rose-400/35 bg-rose-500/10 text-rose-100'
};

export interface AdminV4BackupSyncPanelProps {
  adminAuditLogEntries: AdminV4AuditLogEntry[];
  adminAuditLogError: string;
  isLocalArchiveSyncing: boolean;
  localArchiveError: string;
  localArchiveSummary: {
    activeRecords: unknown[];
    unsyncedRecords: unknown[];
    conflictRecords: unknown[];
    deletedRecords: unknown[];
  };
  localArchiveSyncStatus: string;
  localBackupError: string;
  localBackupStatus: string;
  formatLocalTimestamp: (timestamp?: number | null) => string;
  onBack: () => void;
  onExportFullLocalBackup: () => void | Promise<void>;
  onExportSafeLocalSummary: () => void | Promise<void>;
  onImportFullLocalBackup: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onRefreshAdminAuditLogEntries: () => void | Promise<void>;
  onSyncLocalArchiveToFirebase: () => void | Promise<void>;
}

export default function AdminV4BackupSyncPanel({
  adminAuditLogEntries,
  adminAuditLogError,
  isLocalArchiveSyncing,
  localArchiveError,
  localArchiveSummary,
  localArchiveSyncStatus,
  localBackupError,
  localBackupStatus,
  formatLocalTimestamp,
  onBack,
  onExportFullLocalBackup,
  onExportSafeLocalSummary,
  onImportFullLocalBackup,
  onRefreshAdminAuditLogEntries,
  onSyncLocalArchiveToFirebase
}: AdminV4BackupSyncPanelProps) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Sync And Backup"
        description="Local archive sync and full Admin V4 device backup."
        action={<AdminButton onClick={onBack}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AdminSurface className="p-4">
          <h3 className="text-lg font-black text-white">Local Archive Sync</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SummaryCard label="Active Records" value={localArchiveSummary.activeRecords.length} />
            <SummaryCard label="Unsynced" value={localArchiveSummary.unsyncedRecords.length} />
            <SummaryCard label="Conflicts" value={localArchiveSummary.conflictRecords.length} />
            <SummaryCard label="Tombstones" value={localArchiveSummary.deletedRecords.length} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-400">
            Sync is a remote write to Firebase. Admin V4 previews the record count and blocks conflicts instead of overwriting remote data.
          </p>
          <AdminButton
            tone="amber"
            className="mt-4"
            onClick={() => void onSyncLocalArchiveToFirebase()}
            disabled={isLocalArchiveSyncing || localArchiveSummary.unsyncedRecords.length === 0}
          >
            <Upload className="h-4 w-4" />Preview And Sync To Firebase
          </AdminButton>
          {localArchiveSyncStatus && <div className="mt-3 text-sm font-semibold text-amber-100">{localArchiveSyncStatus}</div>}
          {localArchiveError && <div className="mt-3 text-sm font-semibold text-red-100">{localArchiveError}</div>}
        </AdminSurface>

        <AdminSurface className="p-4">
          <h3 className="text-lg font-black text-white">Full Local Backup</h3>
          <p className="mt-2 text-sm text-slate-400">
            Exports scout archive, Pre Scout public-profile cache and returned evidence, source cache, uploaded files, model snapshots, scout plans, and scout reward data. FIRST tokens are not included.
          </p>
          <div className="admin-g2-sm mt-3 border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
            This backup may contain team strategy, scout names, scout performance/game data, and local source cache. Use safe audience exports in Reports when you do not need a full device restore file.
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="admin-g2-sm inline-flex cursor-pointer items-center gap-2 border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm font-black text-amber-50 hover:bg-amber-500/25">
              <Upload className="h-4 w-4" />Preview Import Backup
              <input type="file" accept=".json,application/json" className="hidden" onChange={onImportFullLocalBackup} />
            </label>
            <AdminButton tone="cyan" onClick={() => void onExportSafeLocalSummary()}><Download className="h-4 w-4" />Export Safe Summary</AdminButton>
            <AdminButton tone="amber" onClick={() => void onExportFullLocalBackup()}><Download className="h-4 w-4" />Export Full Backup</AdminButton>
          </div>
          {localBackupStatus && <div className="mt-3 text-sm font-semibold text-emerald-100">{localBackupStatus}</div>}
          {localBackupError && <div className="mt-3 text-sm font-semibold text-red-100">{localBackupError}</div>}
        </AdminSurface>

        <AdminSurface className="p-4 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">Admin Operation Log</h3>
              <p className="mt-2 text-sm text-slate-400">Local-only audit trail for sensitive admin actions on this device. It records what changed, not secret values.</p>
            </div>
            <AdminButton tone="slate" onClick={() => void onRefreshAdminAuditLogEntries()}>
              <RefreshCw className="h-4 w-4" />Refresh Log
            </AdminButton>
          </div>
          {adminAuditLogError && (
            <div className="admin-g2-sm mt-4 border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
              {adminAuditLogError}
            </div>
          )}
          <div className="admin-g2-sm mt-4 overflow-hidden border border-slate-800">
            {adminAuditLogEntries.length === 0 ? (
              <AdminEmptyState
                title="No sensitive admin actions recorded yet"
                why="This is good on a fresh device. The log fills only when backup, credential, sync, or reward actions happen locally."
                action="Review this after any restore, export, credential clear, Firebase sync, or scout reward change."
              />
            ) : (
              <div className="divide-y divide-slate-800">
                {adminAuditLogEntries.slice(0, 8).map(entry => (
                  <div key={entry.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-white">{entry.action}</span>
                        <span className={`admin-g2-sm border px-2 py-1 text-[11px] font-black uppercase tracking-wider ${auditSeverityClass[entry.severity]}`}>
                          {entry.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-400">{entry.detail}</p>
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-500 md:text-right">
                      {formatLocalTimestamp(entry.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminSurface>
      </div>
    </AdminSurface>
  );
}
