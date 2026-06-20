import React from 'react';
import { AdminButton, AdminModal } from './AdminV4Primitives';

export interface AdminV4BackupRestoreCategory {
  key: string;
  label: string;
  impact: string;
  count: number;
  selected: boolean;
}

export function AdminV4BackupRestorePreviewModal({
  open,
  eventKey,
  exportedAtLabel,
  categories,
  onToggleCategory,
  onClose,
  onRestore
}: {
  open: boolean;
  eventKey: string;
  exportedAtLabel: string;
  categories: AdminV4BackupRestoreCategory[];
  onToggleCategory: (key: string, selected: boolean) => void;
  onClose: () => void;
  onRestore: () => void;
}) {
  return (
    <AdminModal
      open={open}
      title="Preview Backup Restore"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-500">
            This changes local IndexedDB/localStorage on this admin device. FIRST tokens are not imported.
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton tone="slate" onClick={onClose}>Cancel</AdminButton>
            <AdminButton tone="rose" onClick={onRestore}>Restore Selected Sections</AdminButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
          Restoring from <span className="font-mono font-black">{eventKey}</span>, exported {exportedAtLabel}. Review what will change before restoring.
        </div>
        <div className="grid gap-3">
          {categories.map(category => (
            <label
              key={category.key}
              className={`admin-g2-sm flex cursor-pointer items-start gap-3 border p-4 ${
                category.selected
                  ? 'border-cyan-400/35 bg-cyan-500/10'
                  : 'border-slate-800 bg-slate-950'
              }`}
            >
              <input
                type="checkbox"
                checked={category.selected}
                onChange={event => onToggleCategory(category.key, event.target.checked)}
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-white">{category.label}</span>
                  <span className="admin-g2-sm border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-xs font-black text-cyan-100">
                    {category.count}
                  </span>
                </span>
                <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-400">{category.impact}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="admin-g2-sm border border-slate-800 bg-slate-950 px-4 py-3 text-xs font-semibold leading-relaxed text-slate-400">
          Scout archive conflicts are preserved separately. Remote Firebase rows are not overwritten by this restore; the restore only rebuilds this browser/device's local Admin V4 state.
        </div>
      </div>
    </AdminModal>
  );
}

export default AdminV4BackupRestorePreviewModal;
