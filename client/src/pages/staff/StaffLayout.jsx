import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from '../../components/BottomNav.jsx';
import { usePoll } from '../../lib/usePoll.js';
import { useToast } from '../../context/ToastContext.jsx';

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {
    /* sound is optional */
  }
}

/** Staff shell: one dashboard poll shared by all pages, plus a chime when new payments arrive. */
export default function StaffLayout() {
  const dash = usePoll('/staff/dashboard', 4000);
  const lastPending = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const n = dash.data?.pending_payments;
    if (n == null) return;
    if (lastPending.current != null && n > lastPending.current) {
      toast(`${n - lastPending.current} new order${n - lastPending.current > 1 ? 's' : ''} waiting for payment check`, 'info');
      beep();
    }
    lastPending.current = n;
  }, [dash.data, toast]);

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-bg md:border-x md:border-stroke/60 lg:max-w-5xl">
      <main className="pb-24">
        <Outlet context={{ dash }} />
      </main>
      <BottomNav
        wide
        items={[
          { to: '/staff', end: true, icon: 'grid', label: 'Dashboard' },
          { to: '/staff/orders', icon: 'list', label: 'Orders', badge: dash.data?.pending_payments || 0 },
          { to: '/staff/menu', icon: 'utensils', label: 'Menu' },
          { to: '/staff/analytics', icon: 'chart', label: 'Analytics' },
          { to: '/staff/profile', icon: 'user', label: 'Profile' },
        ]}
      />
    </div>
  );
}
