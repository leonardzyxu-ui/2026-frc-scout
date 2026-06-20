import React from 'react';
import { X } from 'lucide-react';

export interface AdminWorkflowItem<T extends string> {
  id?: string;
  key: T;
  label: string;
  description: string;
  mobileNeed?: string;
  panel?: string;
  icon?: React.ReactNode;
  tone?: 'cyan' | 'emerald' | 'fuchsia' | 'amber' | 'rose' | 'slate';
}

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
    <Component className={`admin-g2 border border-slate-800 bg-slate-900/65 shadow-sm shadow-slate-950/10 ${className}`} {...props}>
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

export const AdminInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function AdminInput({
  className = '',
  ...props
}, ref) {
  return (
    <input
      ref={ref}
      className={`admin-g2-sm border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400 ${className}`}
      {...props}
    />
  );
});

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
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    const getFocusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [])
      .filter(element => !element.hasAttribute('disabled') && element.offsetParent !== null);
    const focusFirst = () => (getFocusable()[0] || dialogRef.current)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.setTimeout(focusFirst, 0);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      opener?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="admin-g2-lg max-h-[90vh] w-full max-w-4xl overflow-hidden border border-slate-700 bg-slate-950 shadow-md shadow-slate-950/30 outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <h2 id={titleId} className="text-xl font-black text-white">{title}</h2>
          <AdminIconButton onClick={onClose} aria-label={`Close ${title}`}>
            <X aria-hidden="true" className="h-4 w-4" />
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
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuLeft = typeof window === 'undefined' ? x : Math.min(Math.max(8, x), Math.max(8, window.innerWidth - 220));
  const menuTop = typeof window === 'undefined' ? y : Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 180));

  React.useEffect(() => {
    const handleClick = () => onClose();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"],button:not([disabled])') || []);
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.findIndex(item => item === document.activeElement);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex === -1
        ? direction === 1 ? 0 : items.length - 1
        : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => {
      const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"],button:not([disabled])');
      firstItem?.focus();
    }, 0);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className="fixed z-[60] min-w-44 admin-g2-sm border border-slate-700 bg-slate-950 p-1 shadow-md shadow-slate-950/30"
      style={{ left: menuLeft, top: menuTop }}
      onClick={event => event.stopPropagation()}
    >
      {children}
    </div>
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
