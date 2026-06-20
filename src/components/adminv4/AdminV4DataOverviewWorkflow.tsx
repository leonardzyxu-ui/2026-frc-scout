import React from 'react';
import { AdminSurface } from './AdminV4Primitives';
import { FocusHeader } from './AdminV4UiAtoms';

export type AdminV4DataTone = 'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose';

export interface AdminV4DataPriorityItem<TPanel extends string> {
  label: string;
  detail: string;
  actionLabel: string;
  panel: TPanel;
  tone: AdminV4DataTone;
}

export interface AdminV4DataPulseRow<TPanel extends string> {
  label: string;
  value: number | string;
  detail: string;
  panel: TPanel;
}

export interface AdminV4DataSignalRow<TPanel extends string> {
  label: string;
  value: string;
  detail: string;
  actionLabel: string;
  panel: TPanel;
  tone: AdminV4DataTone;
}

export interface AdminV4DataQuickNeed<TPanel extends string> {
  label: string;
  detail: string;
  actionLabel: string;
  panel: TPanel;
  tone: AdminV4DataTone;
}

export interface AdminV4DataCard<TPanel extends string> {
  panel: TPanel;
  step: string;
  title: string;
  when: string;
  output: string;
  health: string;
  icon: React.ReactNode;
  tone: AdminV4DataTone;
}

const dataToneClass: Record<AdminV4DataTone, string> = {
  cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
  emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  amber: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100',
  slate: 'border-slate-700 bg-slate-950 text-slate-200',
  rose: 'border-rose-400/30 bg-rose-500/10 text-rose-100'
};

export function AdminV4DataOverviewWorkflow<TPanel extends string>({
  dataCards,
  dataPulseRows,
  primaryDataPriority,
  quickNeeds,
  signalSpineRows,
  visiblePriorityQueue,
  onOpenPanel
}: {
  dataCards: AdminV4DataCard<TPanel>[];
  dataPulseRows: AdminV4DataPulseRow<TPanel>[];
  primaryDataPriority: AdminV4DataPriorityItem<TPanel>;
  quickNeeds: AdminV4DataQuickNeed<TPanel>[];
  signalSpineRows: AdminV4DataSignalRow<TPanel>[];
  visiblePriorityQueue: AdminV4DataPriorityItem<TPanel>[];
  onOpenPanel: (panel: TPanel) => void;
}) {
  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Data Control Room"
        description="Use this when the decision screens feel wrong: source data, scout coverage, model health, assignments, sync, and backup."
      />

      <section className="admin-g2-sm mt-5 border border-cyan-400/25 bg-cyan-500/10 p-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">During Competition</div>
            <h3 className="mt-1 text-lg font-black text-white">Say the problem, not the panel name</h3>
          </div>
          <p className="max-w-2xl text-xs font-semibold leading-relaxed text-cyan-100/75">
            These are the emergency doors for a loud pit or stands moment: schedule stale, scouts missing, numbers wrong, model trust, returned evidence, or device handoff.
          </p>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {quickNeeds.map(need => (
            <button
              key={`competition-${need.label}`}
              type="button"
              onClick={() => onOpenPanel(need.panel)}
              className={`admin-g2-sm border px-3 py-2 text-left transition-colors hover:bg-slate-900 ${dataToneClass[need.tone]}`}
              aria-label={`Open Data help to ${need.label}. ${need.detail}`}
              title={`I need to ${need.label}`}
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.16em] opacity-70">I need to</span>
              <span className="mt-0.5 block text-sm font-black text-white">{need.label}</span>
              <span className="mt-1 block truncate text-[11px] font-semibold opacity-75">{need.actionLabel}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <button
          type="button"
          onClick={() => onOpenPanel(primaryDataPriority.panel)}
          className={`admin-g2 border p-5 text-left transition-colors hover:bg-slate-900 ${dataToneClass[primaryDataPriority.tone]}`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.18em] opacity-80">Next Data Action</div>
              <h3 className="mt-1 text-2xl font-black text-white">{primaryDataPriority.label}</h3>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed opacity-85">{primaryDataPriority.detail}</p>
            </div>
            <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase text-white/80">{primaryDataPriority.actionLabel}</span>
          </div>
        </button>

        <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4">
          <div className="text-sm font-black text-white">System Pulse</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {dataPulseRows.map(row => (
              <button
                key={row.label}
                type="button"
                onClick={() => onOpenPanel(row.panel)}
                className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition-colors hover:border-cyan-400/35 hover:bg-slate-900"
              >
                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{row.label}</span>
                <span className="mt-1 block text-lg font-black text-white">{row.value}</span>
                <span className="block truncate text-[11px] font-semibold text-slate-500">{row.detail}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {signalSpineRows.map((row, index) => (
          <button
            key={row.label}
            type="button"
            onClick={() => onOpenPanel(row.panel)}
            className={`admin-g2-sm border p-4 text-left transition-colors hover:bg-slate-900 ${dataToneClass[row.tone]}`}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Step {index + 1}</div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <span className="text-base font-black text-white">{row.label}</span>
              <span className="font-mono text-xl font-black text-white">{row.value}</span>
            </div>
            <div className="mt-2 truncate text-xs font-semibold opacity-80">{row.actionLabel}</div>
          </button>
        ))}
      </div>

      <details className="admin-g2-sm mt-5 border border-slate-800 bg-slate-950/75 p-3">
        <summary className="cursor-pointer list-none text-sm font-black text-slate-200">
          All Data Tools
        </summary>

        <div className="admin-details-body">
          {visiblePriorityQueue.length > 1 && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {visiblePriorityQueue.slice(1).map(priority => (
                <button
                  key={priority.label}
                  type="button"
                  onClick={() => onOpenPanel(priority.panel)}
                  className={`admin-g2-sm border p-4 text-left transition-colors hover:bg-slate-900 ${dataToneClass[priority.tone]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{priority.label}</span>
                    <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">{priority.actionLabel}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed opacity-85">{priority.detail}</div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dataCards.map(card => (
              <button
                key={card.panel}
                type="button"
                onClick={() => onOpenPanel(card.panel)}
                className={`admin-g2-sm border p-4 text-left transition-colors hover:bg-slate-900 ${dataToneClass[card.tone]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="admin-g2-sm border border-white/15 bg-white/10 p-2 text-white">{card.icon}</span>
                    <span>
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Step {card.step}</span>
                      <span className="block text-base font-black text-white">{card.title}</span>
                    </span>
                  </div>
                  <span className="admin-g2-sm border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">{card.health}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs font-semibold leading-relaxed opacity-85">{card.output}</p>
                <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-relaxed opacity-65">{card.when}</p>
              </button>
            ))}
          </div>
        </div>
      </details>
    </AdminSurface>
  );
}

export default AdminV4DataOverviewWorkflow;
