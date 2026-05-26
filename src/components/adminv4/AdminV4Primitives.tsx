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

type AdminTone = 'slate' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'fuchsia';

const buttonToneClasses: Record<AdminTone, string> = {
  slate: 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800',
  cyan: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-50 hover:bg-cyan-500/25',
  emerald: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25',
  amber: 'border-amber-400/40 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25',
  rose: 'border-rose-400/40 bg-rose-500/15 text-rose-50 hover:bg-rose-500/25',
  fuchsia: 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-50 hover:bg-fuchsia-500/25'
};

export function AdminSurface({
  children,
  className = '',
  as: Component = 'section',
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Component className={`admin-g2 border border-slate-800 bg-slate-900/65 shadow-xl shadow-slate-950/20 ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function AdminButton({
  children,
  className = '',
  tone = 'slate',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: AdminTone;
}) {
  return (
    <button
      type="button"
      className={`admin-g2-sm inline-flex items-center justify-center gap-2 border px-4 py-2.5 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonToneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminIconButton({
  children,
  className = '',
  tone = 'slate',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: AdminTone;
}) {
  return (
    <button
      type="button"
      className={`admin-g2-sm inline-flex h-10 w-10 shrink-0 items-center justify-center border text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonToneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`admin-g2-sm border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400 ${className}`}
      {...props}
    />
  );
}

export function AdminModal({
  open,
  title,
  children,
  onClose,
  footer
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
      <div className="admin-g2-lg max-h-[90vh] w-full max-w-4xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl shadow-slate-950">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <h2 className="text-xl font-black text-white">{title}</h2>
          <AdminIconButton onClick={onClose} aria-label={`Close ${title}`}>
            X
          </AdminIconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-slate-800 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function AdminContextMenu({
  x,
  y,
  children,
  onClose
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const handleClose = () => onClose();
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleClose);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-[60] min-w-44 admin-g2-sm border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-slate-950"
      style={{ left: x, top: y }}
      onClick={event => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

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
            className={`admin-g2-sm group w-full border px-4 py-3 text-left transition-all ${
              isActive
                ? `border-transparent bg-gradient-to-br ${tone} ring-1`
                : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {item.icon && (
                <span className={`admin-g2-sm p-2 ${isActive ? 'bg-white/10' : 'bg-slate-900 text-slate-400 group-hover:text-slate-100'}`}>
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
    <div className="admin-v4-context-bar admin-g2 border border-slate-800/80 bg-slate-900/75 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {items.map(item => (
            <div key={item.label} className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-4 py-3">
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
    <section className="admin-surface p-5">
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
    <section className="admin-g2 border border-rose-500/30 bg-rose-500/10 p-5">
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
    <section className="admin-surface p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-black text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-4 py-8 text-center text-sm font-semibold text-slate-500">
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
              <div key={row.key} className={`admin-g2-sm border border-slate-800 bg-slate-950/70 p-3 ${ring}`}>
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
