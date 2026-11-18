import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }) {
  const v = {
    primary: 'bg-lime text-bg hover:brightness-105 active:brightness-95 font-semibold',
    secondary: 'bg-surface2 text-ink border border-stroke hover:border-muted/50',
    ghost: 'text-ink hover:bg-surface2',
    danger: 'bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25',
    peri: 'bg-peri text-bg font-semibold hover:brightness-105',
    ok: 'bg-ok text-bg font-semibold hover:brightness-105',
  }[variant];
  const s = { sm: 'h-9 px-3 text-sm rounded-xl', md: 'h-12 px-5 rounded-2xl', lg: 'h-14 px-6 text-lg rounded-2xl' }[size];
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 transition select-none disabled:opacity-45 disabled:pointer-events-none',
        v, s, className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-6 w-6' }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
      <Spinner className="h-7 w-7 text-lime" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Card({ className, children, ...rest }) {
  return (
    <div className={cx('rounded-3xl border border-stroke bg-surface p-4', className)} {...rest}>
      {children}
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>}
        {children}
      </label>
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-muted">{hint}</span>
      ) : null}
    </div>
  );
}

const inputCls = (error) =>
  cx(
    'w-full rounded-2xl border bg-surface2 px-4 text-ink placeholder:text-muted/70 outline-none transition',
    'focus:border-lime/70 focus:ring-2 focus:ring-lime/20',
    error ? 'border-bad/70' : 'border-stroke'
  );

export function Input({ error, className, ...rest }) {
  return <input className={cx(inputCls(error), 'h-12', className)} {...rest} />;
}

export function Textarea({ error, className, ...rest }) {
  return <textarea className={cx(inputCls(error), 'min-h-20 py-3', className)} {...rest} />;
}

export function Select({ error, className, children, ...rest }) {
  return (
    <select className={cx(inputCls(error), 'h-12 appearance-none', className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50',
        checked ? 'bg-lime' : 'bg-stroke'
      )}
    >
      <span
        className={cx(
          'absolute top-1 h-5 w-5 rounded-full transition-all',
          checked ? 'left-6 bg-bg' : 'left-1 bg-muted'
        )}
      />
    </button>
  );
}

export function Chip({ active, children, className, ...rest }) {
  return (
    <button
      type="button"
      className={cx(
        'h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition',
        active ? 'border-lime bg-lime text-bg' : 'border-stroke bg-surface text-ink/85 hover:border-muted/50',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function VegDot({ veg, className }) {
  return (
    <span
      title={veg ? 'Veg' : 'Non-veg'}
      aria-label={veg ? 'Veg' : 'Non-veg'}
      className={cx('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] bg-white/0', veg ? 'border-ok' : 'border-bad', className)}
    >
      <span className={cx('h-2 w-2 rounded-full', veg ? 'bg-ok' : 'bg-bad')} />
    </span>
  );
}

const STATUS = {
  awaiting_payment: ['Awaiting payment', 'bg-warn/15 text-warn', 'wallet'],
  pending_payment: ['Payment pending', 'bg-warn/15 text-warn', 'clock'],
  confirmed: ['Confirmed', 'bg-peri/15 text-peri', 'check'],
  preparing: ['Preparing', 'bg-peri/15 text-peri', 'chef'],
  ready: ['Ready', 'bg-lime/15 text-lime', 'bell'],
  collected: ['Collected', 'bg-ok/15 text-ok', 'check'],
  rejected: ['Payment rejected', 'bg-bad/15 text-bad', 'x'],
  cancelled: ['Cancelled', 'bg-stroke text-muted', 'x'],
};

export function StatusPill({ status, className }) {
  const [label, cls, icon] = STATUS[status] || [status, 'bg-stroke text-muted', 'alert'];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', cls, className)}>
      <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}

export function Empty({ icon = 'bag', title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl border border-stroke bg-surface text-muted">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{error.message || String(error)}</span>
      {onRetry && (
        <button className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Bottom-sheet modal. */
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-sheet safe-bottom relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] border border-b-0 border-stroke bg-surface px-5 pb-6 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stroke" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted" aria-label="Close">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, back, right, subtitle }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stroke/60 bg-bg/90 px-4 py-3 backdrop-blur">
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
          className="grid h-10 w-10 place-items-center rounded-full border border-stroke bg-surface"
          aria-label="Back"
        >
          <Icon name="back" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-xl font-semibold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Stat({ label, value, icon, accent = 'text-ink', sub }) {
  return (
    <div className="rounded-3xl border border-stroke bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
        {icon && <Icon name={icon} className="h-4 w-4" />}
        {label}
      </div>
      <div className={cx('font-display text-2xl font-semibold tabular-nums', accent)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function FoodImage({ src, name, className }) {
  return src ? (
    <img src={src} alt={name} loading="lazy" className={cx('object-cover', className)} />
  ) : (
    <div className={cx('grid place-items-center bg-surface2 text-muted', className)}>
      <Icon name="utensils" className="h-7 w-7" />
    </div>
  );
}

export function Logo({ size = 'text-2xl' }) {
  return (
    <span className={cx('font-display font-bold tracking-tight', size)}>
      Q<span className="text-lime">Less</span>
    </span>
  );
}

export function RowLink({ to, icon, label, sub, onClick, danger }) {
  const inner = (
    <>
      <span className={cx('grid h-10 w-10 place-items-center rounded-2xl bg-surface2', danger ? 'text-bad' : 'text-lime')}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="flex-1">
        <span className={cx('block font-medium', danger && 'text-bad')}>{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      {!danger && <Icon name="chevron" className="h-4 w-4 text-muted" />}
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface2/60';
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export { cx };
