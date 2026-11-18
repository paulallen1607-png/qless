import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Logo } from '../components/ui.jsx';

function RoleCard({ to, icon, title, text, accent }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-3xl border border-stroke bg-surface p-5 transition hover:border-lime/50 hover:bg-surface2"
    >
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${accent}`}>
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <span className="flex-1">
        <span className="block font-display text-xl font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <Icon name="chevron" className="h-5 w-5 text-muted transition group-hover:translate-x-1 group-hover:text-lime" />
    </Link>
  );
}

export default function Welcome() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-8 pt-12">
      <Logo size="text-3xl" />
      <div className="relative mt-10 overflow-hidden rounded-[28px] border border-stroke bg-surface p-6">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-peri/10 blur-2xl" />
        <p className="relative text-xs font-semibold uppercase tracking-[.2em] text-lime">College food court</p>
        <h1 className="relative mt-3 font-display text-4xl font-bold leading-[1.05]">
          Skip the line.
          <br />
          Grab your food.
        </h1>
        <p className="relative mt-3 text-sm text-muted">
          Order from your phone, pay with UPI, and walk up when your token is called.
        </p>
        <div className="relative mt-6 flex items-end gap-3">
          <div className="rounded-2xl bg-lime px-4 py-2 text-bg">
            <div className="text-[10px] font-bold uppercase tracking-wider">Token</div>
            <div className="font-display text-3xl font-bold leading-none">#24</div>
          </div>
          <div className="pb-1 text-sm text-muted">
            Ready in <span className="font-semibold text-ink">~6 min</span>
          </div>
        </div>
      </div>

      <p className="mb-3 mt-10 text-sm font-medium text-muted">Continue as</p>
      <div className="space-y-3">
        <RoleCard to="/student/login" icon="user" title="I'm a Student" text="Order food, pay by UPI, track your token" accent="bg-lime/15 text-lime" />
        <RoleCard to="/staff/login" icon="chef" title="I'm Staff" text="Verify payments, run the queue, manage the menu" accent="bg-peri/15 text-peri" />
      </div>
      <p className="mt-auto pt-10 text-center text-xs text-muted">QLess · Food court only</p>
    </div>
  );
}
