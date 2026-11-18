import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon.jsx';
import { Logo } from '../../components/ui.jsx';

export default function AuthShell({ title, subtitle, badge, children, footer }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="grid h-10 w-10 place-items-center rounded-full border border-stroke bg-surface" aria-label="Back">
          <Icon name="back" />
        </Link>
        <Logo size="text-xl" />
        <span className="w-10" />
      </div>
      <div className="mt-10">
        {badge}
        <h1 className="mt-3 font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}

export const RoleBadge = ({ staff }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
      staff ? 'bg-peri/15 text-peri' : 'bg-lime/15 text-lime'
    }`}
  >
    <Icon name={staff ? 'chef' : 'user'} className="h-3.5 w-3.5" />
    {staff ? 'Staff' : 'Student'}
  </span>
);

export const RememberBox = ({ checked, onChange }) => (
  <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#C6FF4D]" />
    Keep me logged in
  </label>
);
