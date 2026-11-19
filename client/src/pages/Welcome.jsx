import { useCallback, useEffect, useState } from 'react';
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

const COLLEGE = 'Sri Krishna College of Engineering and Technology';

function CapIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
      <path d="M7 11.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
      <path d="M21 9.5V14" />
    </svg>
  );
}

function seenIntro() {
  try {
    return sessionStorage.getItem('qless_intro') === '1';
  } catch {
    return false;
  }
}

/** Full-screen intro: the college name appears word by word, then fades into the page. */
function CollegeIntro({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => setLeaving(true), reduce ? 900 : 3300);
    const t2 = setTimeout(onDone, reduce ? 1200 : 3900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);
  const words = COLLEGE.split(' ');
  return (
    <button
      type="button"
      onClick={onDone}
      aria-label={`${COLLEGE} presents QLess. Tap to skip.`}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-8 text-center ${leaving ? 'intro-out' : ''}`}
    >
      <span className="intro-glow pointer-events-none absolute h-72 w-72 rounded-full bg-lime/15 blur-3xl" aria-hidden="true" />
      <span className="intro-pop relative grid h-20 w-20 place-items-center rounded-3xl bg-lime text-bg">
        <CapIcon className="h-10 w-10" />
        <span className="animate-ring absolute inset-0 rounded-3xl" aria-hidden="true" />
      </span>
      <span className="relative mt-8 block max-w-[340px] font-display text-[26px] font-bold leading-tight">
        {words.map((w, i) => (
          <span key={i} className="intro-word inline-block" style={delay(0.45 + i * 0.12)}>
            {w}&nbsp;
          </span>
        ))}
      </span>
      <span className="intro-line relative mt-5 block h-[3px] w-40 rounded-full bg-lime" style={delay(1.35)} aria-hidden="true" />
      <span className="intro-word relative mt-6 block text-xs font-semibold uppercase tracking-[.3em] text-muted" style={delay(1.75)}>
        presents
      </span>
      <span className="intro-word relative mt-2 block" style={delay(2.0)}>
        <Logo size="text-4xl" />
      </span>
      <span className="absolute bottom-8 text-[11px] text-muted/70">Tap to skip</span>
    </button>
  );
}

export default function Welcome() {
  const [intro, setIntro] = useState(() => !seenIntro());
  const finish = useCallback(() => {
    try {
      sessionStorage.setItem('qless_intro', '1');
    } catch {}
    setIntro(false);
  }, []);
  if (intro) return <CollegeIntro onDone={finish} />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-6 pt-6">
      <div className="animate-rise relative overflow-hidden rounded-[28px] border border-stroke bg-surface p-6" style={delay(0)}>
        <div className="animate-drift absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime/10 blur-2xl" />
        <div className="animate-drift-slow absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-peri/10 blur-2xl" />
        <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-lime/15 text-lime">
          <CapIcon className="h-6 w-6" />
        </span>
        <p className="relative mt-4 text-[11px] font-semibold uppercase tracking-[.2em] text-lime">Food court of</p>
        <h1 className="relative mt-2 font-display text-[26px] font-bold leading-tight">
          {COLLEGE.split(' ').map((w, i) => (
            <span key={i} className="intro-word inline-block" style={delay(0.15 + i * 0.07)}>
              {w}&nbsp;
            </span>
          ))}
        </h1>
        <span className="intro-line relative mt-4 block h-[3px] w-24 rounded-full bg-lime" style={delay(0.75)} aria-hidden="true" />
      </div>

      <div className="animate-rise mt-8 flex items-center justify-between" style={delay(0.3)}>
        <Logo size="text-4xl" />
        <span className="text-xs text-muted">Skip the queue</span>
      </div>

      <p className="animate-rise mb-3 mt-8 text-sm font-medium text-muted" style={delay(0.42)}>Continue as</p>
      <div className="animate-rise space-y-3" style={delay(0.5)}>
        <RoleCard to="/student/login" icon="user" title="I'm a Student" text="Order food, pay by UPI, track your token" accent="bg-lime/15 text-lime" />
        <RoleCard to="/staff/login" icon="chef" title="I'm Staff" text="Verify payments, run the queue, manage the menu" accent="bg-peri/15 text-peri" />
      </div>
      <div className="animate-rise mt-auto pt-8" style={delay(0.65)}>
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
