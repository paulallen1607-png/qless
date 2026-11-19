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

const delay = (s) => ({ animationDelay: `${s}s` });

export default function Welcome() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-6 pt-6">
      <div className="animate-rise flex items-center gap-3 rounded-2xl border border-stroke bg-surface/70 px-4 py-3" style={delay(0)}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime/15 text-lime">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
            <path d="M7 11.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
            <path d="M21 9.5V14" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-muted">Food court of</span>
          <span className="block font-display text-[15px] font-semibold leading-snug">Sri Krishna College of Engineering and Technology</span>
        </span>
      </div>

      <div className="animate-rise mt-6" style={delay(0.12)}>
        <Logo size="text-3xl" />
      </div>
      <div className="animate-rise relative mt-6 overflow-hidden rounded-[28px] border border-stroke bg-surface p-6" style={delay(0.24)}>
        <div className="animate-drift absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime/10 blur-2xl" />
        <div className="animate-drift-slow absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-peri/10 blur-2xl" />
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
          <div className="animate-float rounded-2xl bg-lime px-4 py-2 text-bg">
            <div className="text-[10px] font-bold uppercase tracking-wider">Token</div>
            <div className="font-display text-3xl font-bold leading-none">#24</div>
          </div>
          <div className="flex items-center gap-2 pb-1 text-sm text-muted">
            <span className="animate-blink h-2 w-2 rounded-full bg-lime" aria-hidden="true" />
            Ready in <span className="font-semibold text-ink">~6 min</span>
          </div>
        </div>
      </div>

      <p className="animate-rise mb-3 mt-6 text-sm font-medium text-muted" style={delay(0.36)}>Continue as</p>
      <div className="animate-rise space-y-3" style={delay(0.44)}>
        <RoleCard to="/student/login" icon="user" title="I'm a Student" text="Order food, pay by UPI, track your token" accent="bg-lime/15 text-lime" />
        <RoleCard to="/staff/login" icon="chef" title="I'm Staff" text="Verify payments, run the queue, manage the menu" accent="bg-peri/15 text-peri" />
      </div>
      <div className="animate-rise mt-auto pt-6" style={delay(0.6)}>
        <div className="border-flow mx-auto w-fit rounded-full p-[1.5px]">
          <div className="flex items-center gap-2 rounded-full bg-bg px-5 py-2.5">
            <span className="text-xs text-muted">Crafted by Team</span>
            <span className="text-shimmer font-display text-base font-bold tracking-wide">InnovateX</span>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted">QLess · SKCET food court</p>
      </div>
    </div>
  );
}
