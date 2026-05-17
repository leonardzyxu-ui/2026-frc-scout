import React from 'react';

export interface WorkspaceNavItem<T extends string> {
  key: T;
  label: string;
  description: string;
  icon?: React.ReactNode;
  tone?: 'cyan' | 'emerald' | 'fuchsia' | 'amber' | 'rose' | 'slate';
}

const toneClasses: Record<NonNullable<WorkspaceNavItem<string>['tone']>, string> = {
  cyan: 'from-cyan-500/20 to-sky-500/10 text-cyan-100 ring-cyan-400/30',
  emerald: 'from-emerald-500/20 to-teal-500/10 text-emerald-100 ring-emerald-400/30',
  fuchsia: 'from-fuchsia-500/20 to-purple-500/10 text-fuchsia-100 ring-fuchsia-400/30',
  amber: 'from-amber-500/20 to-orange-500/10 text-amber-100 ring-amber-400/30',
  rose: 'from-rose-500/20 to-red-500/10 text-rose-100 ring-rose-400/30',
  slate: 'from-slate-800/80 to-slate-900/60 text-slate-100 ring-slate-700'
};

export function WorkspaceNav<T extends string>({
  items,
  activeKey,
  onChange
}: {
  items: WorkspaceNavItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
}) {
  return (
    <nav className="space-y-2">
      {items.map(item => {
        const isActive = activeKey === item.key;
        const tone = toneClasses[item.tone || 'slate'];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`group w-full rounded-2xl border px-4 py-3 text-left transition-all ${
              isActive
                ? `border-transparent bg-gradient-to-br ${tone} ring-1`
                : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {item.icon && (
                <span className={`rounded-xl p-2 ${isActive ? 'bg-white/10' : 'bg-slate-900 text-slate-400 group-hover:text-slate-100'}`}>
                  {item.icon}
                </span>
              )}
              <div>
                <div className="text-sm font-black text-white">{item.label}</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-400">{item.description}</div>
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}

export function ContextBar({
  items,
  action
}: {
  items: Array<{ label: string; value: React.ReactNode; tone?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="admin-v4-context-bar rounded-3xl border border-slate-800/80 bg-slate-900/75 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {items.map(item => (
            <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
              <div className={`mt-1 truncate text-sm font-black ${item.tone || 'text-white'}`}>{item.value}</div>
            </div>
          ))}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function ActionGroup({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-black text-white">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

export function DangerZone({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5">
      <h3 className="text-lg font-black text-rose-50">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-rose-100/80">{description}</p>
      <div className="mt-4 flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

export function MetricBarChart({
  title,
  subtitle,
  rows,
  valueFormatter = value => value.toFixed(1),
  accentClass = 'from-cyan-400 to-blue-500'
}: {
  title: string;
  subtitle?: string;
  rows: Array<{ key: string; label: string; value: number; secondary?: string; highlighted?: 'own' | 'searched' | 'both' }>;
  valueFormatter?: (value: number) => string;
  accentClass?: string;
}) {
  const maxValue = Math.max(1, ...rows.map(row => Math.max(0, row.value)));
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-black text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-8 text-center text-sm font-semibold text-slate-500">
            No chartable team data yet.
          </div>
        ) : (
          rows.map((row, index) => {
            const width = `${Math.max(4, (Math.max(0, row.value) / maxValue) * 100)}%`;
            const ring =
              row.highlighted === 'both'
                ? 'ring-2 ring-sky-300 bg-orange-500/10'
                : row.highlighted === 'own'
                  ? 'ring-2 ring-orange-400 bg-orange-500/10'
                  : row.highlighted === 'searched'
                    ? 'ring-2 ring-sky-400 bg-sky-500/10'
                    : '';
            return (
              <div key={row.key} className={`rounded-2xl border border-slate-800 bg-slate-950/70 p-3 ${ring}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-xs font-black text-slate-500">#{index + 1}</span>
                    <span className="truncate text-sm font-black text-white">{row.label}</span>
                    {row.secondary && <span className="hidden truncate text-xs font-semibold text-slate-500 md:inline">{row.secondary}</span>}
                  </div>
                  <span className="font-mono text-sm font-black text-cyan-100">{valueFormatter(row.value)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full bg-gradient-to-r ${accentClass}`} style={{ width }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
