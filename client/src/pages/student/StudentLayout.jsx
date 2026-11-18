import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from '../../components/BottomNav.jsx';
import { Button, Sheet } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';
import { usePoll } from '../../lib/usePoll.js';
import { useToast } from '../../context/ToastContext.jsx';

function notify(title, body) {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 300]);
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification(title, { body });
    }
  } catch {
    /* notifications are best-effort */
  }
}

/** Student shell: bottom nav + a single live poll of active orders that raises alerts on status changes. */
export default function StudentLayout() {
  const active = usePoll('/orders/active', 5000);
  const prev = useRef(null);
  const [readyOrder, setReadyOrder] = useState(null);
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const orders = active.data?.orders;
    if (!orders) return;
    const serving = active.data.now_serving;
    const before = prev.current;
    if (before) {
      for (const o of orders) {
        const old = before.statuses[o.id];
        if (old === o.status) {
          if (serving === o.token && before.serving !== serving && o.status === 'ready') {
            toast(`Token #${o.token} is being called — head to the counter!`, 'ready', 6000);
            notify('Your token is being called', `Token #${o.token} — head to the counter`);
          }
          continue;
        }
        if (o.status === 'ready') {
          setReadyOrder(o);
          notify('Your order is ready!', `Token #${o.token} — collect it at the counter`);
        } else if (o.status === 'confirmed' && old === 'pending_payment') {
          toast(`Payment confirmed for #${o.token}. Your food is in the queue.`, 'success', 4500);
        } else if (o.status === 'preparing') {
          toast(`#${o.token} is being prepared.`, 'info');
        }
      }
      // Orders that disappeared from "active" were collected or rejected.
      for (const id of Object.keys(before.statuses)) {
        if (!orders.find((o) => String(o.id) === id) && before.statuses[id] === 'pending_payment') {
          toast('A payment could not be verified. Check your order for details.', 'error', 6000);
        }
      }
    }
    prev.current = { statuses: Object.fromEntries(orders.map((o) => [o.id, o.status])), serving };
  }, [active.data, toast]);

  // Ask for notification permission once the student has an active paid order.
  useEffect(() => {
    if (active.data?.orders?.some((o) => o.status !== 'awaiting_payment') && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [active.data]);

  const hideNav = loc.pathname.startsWith('/student/pay/');

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-bg md:border-x md:border-stroke/60">
      <main className={hideNav ? 'pb-8' : 'pb-24'}>
        <Outlet context={{ active }} />
      </main>
      {!hideNav && (
        <BottomNav
          items={[
            { to: '/student', end: true, icon: 'home', label: 'Home' },
            { to: '/student/menu', icon: 'utensils', label: 'Menu' },
            { to: '/student/orders', icon: 'receipt', label: 'Orders', badge: active.data?.orders?.length || 0 },
            { to: '/student/profile', icon: 'user', label: 'Profile' },
          ]}
        />
      )}
      <Sheet open={!!readyOrder} onClose={() => setReadyOrder(null)}>
        {readyOrder && (
          <div className="pb-2 pt-4 text-center">
            <div className="animate-ring mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime text-bg">
              <Icon name="bell" className="h-9 w-9" strokeWidth={2.4} />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold">Your order is ready!</h2>
            <p className="mt-1 text-muted">Show this token at the counter</p>
            <div className="mt-4 font-display text-7xl font-bold text-lime">#{readyOrder.token}</div>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                const id = readyOrder.id;
                setReadyOrder(null);
                nav(`/student/orders/${id}`);
              }}
            >
              View order
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
