import React from 'react';
import { Download } from 'lucide-react';
import { AdminButton, AdminSurface } from './AdminV4Primitives';
import { FocusHeader, SummaryCard } from './AdminV4UiAtoms';

export type AdminV4ReportTone = 'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose';

export interface AdminV4ReportPackAction {
  label: string;
  tone: AdminV4ReportTone;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface AdminV4ReportPack {
  key: string;
  title: string;
  audience: string;
  when: string;
  contains: string;
  status: string;
  tone: AdminV4ReportTone;
  icon: React.ReactNode;
  actions: AdminV4ReportPackAction[];
}

export interface AdminV4WorkbookSection {
  group: string;
  sheets: string;
  use: string;
}

const reportToneClass: Record<AdminV4ReportTone, string> = {
  cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
  emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  amber: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100',
  slate: 'border-slate-700 bg-slate-950 text-slate-200',
  rose: 'border-rose-400/30 bg-rose-500/10 text-rose-100'
};

export function AdminV4ReportsWorkflow({
  summaries,
  reportPacks,
  recommendedPackKey,
  workbookSections,
  modelAction,
  exportStatus,
  onExportWorkbook
}: {
  summaries: Array<{ label: string; value: number | string }>;
  reportPacks: AdminV4ReportPack[];
  recommendedPackKey: string;
  workbookSections: AdminV4WorkbookSection[];
  modelAction: React.ReactNode;
  exportStatus: 'idle' | 'loading' | 'success';
  onExportWorkbook: () => void;
}) {
  const recommendedPack = reportPacks.find(pack => pack.key === recommendedPackKey) || reportPacks[0] || null;
  const recommendedAction = recommendedPack?.actions[0] || null;

  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Reports"
        title="Audience Report Packs"
        description="Reports is the handoff room: export the full evidence, or jump to the exact packet needed by head scout, drive team, pick-list lead, model proof, or data owner."
      />

      {recommendedPack && recommendedAction && (
        <button
          type="button"
          onClick={recommendedAction.onClick}
          disabled={recommendedAction.disabled}
          className={`admin-g2 mt-5 flex w-full flex-col gap-3 border p-4 text-left transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 md:flex-row md:items-center md:justify-between ${reportToneClass[recommendedPack.tone]}`}
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-75">Do This First</span>
            <span className="mt-1 block text-lg font-black text-white">{recommendedPack.title}</span>
            <span className="mt-1 block text-sm font-semibold leading-relaxed opacity-85">
              {recommendedPack.when} Status: {recommendedPack.status}.
            </span>
          </span>
          <span className="admin-g2-sm inline-flex shrink-0 items-center gap-2 border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase text-white/80">
            {recommendedAction.icon}
            {recommendedAction.label}
          </span>
        </button>
      )}

      <div className="mt-4">{modelAction}</div>

      {reportPacks.length > 0 && (
        <section className="admin-g2-sm mt-5 border border-cyan-400/25 bg-cyan-500/10 p-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">If Someone Asks...</div>
              <h3 className="mt-1 text-lg font-black text-white">Pick the audience first</h3>
            </div>
            <p className="max-w-2xl text-xs font-semibold leading-relaxed text-cyan-100/75">
              Reports should answer the person in front of you: head scout, drive team, pick-list lead, model lead, model proof, or data owner. Full XLSX stays behind the advanced door.
            </p>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            {reportPacks.map(pack => {
              const action = pack.actions[0];
              return (
                <button
                  key={`audience-${pack.key}`}
                  type="button"
                  onClick={action?.onClick}
                  disabled={!action || action.disabled}
                  className={`admin-g2-sm border px-3 py-2 text-left transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 ${reportToneClass[pack.tone]}`}
                  aria-label={`Open report for ${pack.audience}: ${pack.title}. ${pack.when}`}
                  title={`Open ${pack.title}`}
                >
                  <span className="block text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{pack.audience}</span>
                  <span className="mt-0.5 block text-sm font-black text-white">{pack.title}</span>
                  <span className="mt-1 block truncate text-[11px] font-semibold opacity-75">{action?.label || pack.status}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {summaries.map(summary => (
          <SummaryCard key={summary.label} label={summary.label} value={summary.value} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <details className="admin-g2 border border-slate-800 bg-slate-950/80 p-4">
          <summary className="cursor-pointer list-none text-sm font-black text-slate-100">
            All Report Pack Details
          </summary>
          <div className="admin-details-body">
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
              Open this when you need the full when/contains/status explanation. The audience shortcuts above are the normal competition path.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {reportPacks.map(pack => (
                <div key={pack.key} className={`admin-g2 border p-5 ${reportToneClass[pack.tone]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="admin-g2-sm border border-white/15 bg-white/10 p-2 text-white">{pack.icon}</span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{pack.audience}</div>
                        <h3 className="mt-1 text-lg font-black text-white">{pack.title}</h3>
                      </div>
                    </div>
                    <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">{pack.status}</span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm font-semibold sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">When</div>
                      <div className="mt-1 opacity-85">{pack.when}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">Contains</div>
                      <div className="mt-1 opacity-85">{pack.contains}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {pack.actions.map(action => (
                      <AdminButton
                        key={action.label}
                        tone={action.tone}
                        onClick={action.onClick}
                        disabled={action.disabled}
                      >
                        {action.icon}
                        {action.label}
                      </AdminButton>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        <div className="admin-g2 border border-slate-800 bg-slate-950 p-5">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Advanced Export</div>
          <h3 className="mt-2 text-xl font-black text-white">Full Evidence Workbook</h3>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-400">
            Use this when someone needs the whole chain of evidence. It is intentionally large, so the audience cards stay first and the workbook stays behind an explicit advanced door.
          </p>
          <details className="mt-5 admin-g2-sm border border-slate-800 bg-slate-900/70 p-3">
            <summary className="cursor-pointer list-none text-sm font-black text-slate-100">
              Show Full XLSX Export
            </summary>
            <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
              Contains collection, validation, expected-range model shape, match strategy, pick list, operations, scout rewards, source freshness, raw evidence, and possibly scout names. Use audience report packs for safer handoffs.
            </p>
            <AdminButton
              tone={exportStatus === 'success' ? 'emerald' : 'cyan'}
              className="mt-4 w-full"
              onClick={onExportWorkbook}
              disabled={exportStatus === 'loading'}
            >
              <Download className="h-4 w-4" />
              {exportStatus === 'loading' ? 'Building XLSX' : exportStatus === 'success' ? 'Download Again' : 'Download Full XLSX'}
            </AdminButton>
          </details>
        </div>
      </div>

      <div className="mt-5 admin-g2 border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Workbook Contents</div>
          <h3 className="mt-1 text-lg font-black text-white">What The Export Proves</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {workbookSections.map(section => (
            <div key={section.group} className="grid gap-3 px-5 py-4 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="font-black text-cyan-100">{section.group}</div>
              <div className="text-sm font-semibold text-slate-300">{section.sheets}</div>
              <div className="text-sm font-semibold leading-relaxed text-slate-500">{section.use}</div>
            </div>
          ))}
        </div>
      </div>
    </AdminSurface>
  );
}

export default AdminV4ReportsWorkflow;
