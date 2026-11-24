import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SYSTEM_BY_ID, LEVEL_LABEL } from '../core/systems';
import type { Level, SystemId } from '../core/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-500',
        variant === 'secondary' && 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-100 dark:hover:bg-ink-800',
        variant === 'ghost' && 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        className,
      )}
    />
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-ink-200 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', !color && 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200', className)}
      style={color ? { backgroundColor: `${color}26`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function SystemBadge({ id }: { id: SystemId }) {
  const s = SYSTEM_BY_ID[id];
  return (
    <Badge className="bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.shortName}
    </Badge>
  );
}

export function LevelBadge({ level }: { level: Level }) {
  const color = level === 'basico' ? '#22c55e' : level === 'intermedio' ? '#f59e0b' : '#ef4444';
  return <Badge color={color}>{LEVEL_LABEL[level]}</Badge>;
}

export function ProgressBar({ value, color = '#08c4a6', className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
        {label}
        {icon}
      </div>
      <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-ink-100 p-1 dark:bg-ink-850">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'rounded-md px-3 py-1.5 text-sm font-medium transition',
            value === t.id ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 p-10 text-center dark:border-ink-700">
      {icon && <div className="mb-3 text-ink-400">{icon}</div>}
      <p className="font-medium text-ink-800 dark:text-ink-100">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-500 dark:text-ink-400">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-50';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${s.toString().padStart(2, '0')} s`;
  return `${s} s`;
}
