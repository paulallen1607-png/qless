import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { ago, minutes, rupees } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Card, ErrorBox, Logo, PageLoader, Stat, Toggle } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';

const ACT_ICON = {
  order: ['bag', 'text-warn'], payment: ['check', 'text-ok'], reject: ['x', 'text-bad'], preparing: ['chef', 'text-peri'],
  ready: ['bell', 'text-lime'], collected: ['check', 'text-ok'], call: ['megaphone', 'text-lime'], skip: ['skip', 'text-warn'],
  menu: ['utensils', 'text-peri'], canteen: ['store', 'text-muted'], settings: ['wallet', 'text-muted'],
};

export function QueueControls({ onDone, size = 'md' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  async function go(kind) {
    setBusy(kind);
    try {
      const d = await api(`/staff/queue/${kind}`, { method: 'POST' });
      toast(d.now_serving ? `Now serving #${d.now_serving}` : 'Queue is empty.', d.now_serving ? 'ready' : 'info');
      onDone?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Button size={size} loading={busy === 'next'} onClick={() => go('next')}>
        <Icon name="megaphone" /> Call Next
      </Button>
      <Button size={size} variant="secondary" loading={busy === 'skip'} onClick={() => go('skip')}>
        <Icon name="skip" className="h-4 w-4" /> Skip
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const { dash } = useOutletContext();
  const { user } = useAuth();
  const toast = useToast();
  const [toggling, setToggling] = useState(false);
  const d = dash.data;

  async function toggle(on) {
    setToggling(true);
    try {
      await api('/staff/accepting', { method: 'POST', body: { accepting: on } });
      await dash.refresh();
      toast(on ? 'Canteen is open for orders' : 'Orders paused. Students can browse but not order.', on ? 'success' : 'info');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setToggling(false);
    }
  }

  if (!d) return dash.error ? <div className="p-4"><ErrorBox error={dash.error} onRetry={dash.refresh} /></div> : <PageLoader />;

  return (
    <div className="px-4 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <Logo size="text-xl" />
          <span className="ml-2 rounded-full bg-peri/15 px-2 py-0.5 text-[11px] font-semibold text-peri">STAFF</span>
        </div>
        <span className="text-sm text-muted">Hi, {user.name.split(' ')[0]}</span>
      </div>

      {!d.upi_configured && (
        <Link to="/staff/payment" className="mt-4 flex items-center gap-2 rounded-2xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">
          <Icon name="alert" className="h-4 w-4" /> Set the canteen UPI ID before students can pay. Tap to fix.
        </Link>
      )}

      <Card className={`mt-5 flex items-center gap-4 ${d.accepting_orders ? 'border-ok/30' : 'border-warn/40 bg-warn/[.05]'}`}>
        <span className={`grid h-12 w-12 place-items-center rounded-2xl ${d.accepting_orders ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}>
          <Icon name={d.accepting_orders ? 'store' : 'pause'} />
        </span>
        <div className="flex-1">
          <div className="font-display text-lg font-semibold">{d.accepting_orders ? 'Accepting orders' : 'Orders paused'}</div>
          <div className="text-xs text-muted">{d.canteen_name}</div>
        </div>
        <Toggle checked={d.accepting_orders} onChange={toggle} disabled={toggling} label="Accept orders" />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Currently serving</div>
            <div className="font-display text-7xl font-bold leading-tight text-lime">{d.now_serving ? `#${d.now_serving}` : '—'}</div>
            <div className="mb-4 text-sm text-muted">
              Next in line: <span className="font-display font-semibold text-ink">{d.next_in_line ? `#${d.next_in_line}` : 'nobody'}</span>
            </div>
            <QueueControls onDone={dash.refresh} size="lg" />
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Waiting" icon="users" value={d.waiting} sub="confirmed, not collected" />
            <Link to="/staff/orders">
              <Stat label="Pending payments" icon="clock" value={d.pending_payments} accent={d.pending_payments ? 'text-warn' : 'text-ink'} sub="tap to verify" />
            </Link>
            <Stat label="Served today" icon="check" value={d.served_today} />
            <Stat label="Earnings today" icon="rupee" value={rupees(d.earnings_today)} accent="text-lime" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-stroke bg-surface px-4 py-3 text-sm">
            <span className="text-muted">Avg service time (from real orders)</span>
            <span className="font-display font-semibold">{minutes(d.avg_service_minutes)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/staff/report" className="flex items-center gap-2 rounded-2xl border border-stroke bg-surface p-3 text-sm font-medium hover:bg-surface2">
              <Icon name="file" className="h-5 w-5 text-peri" /> Daily report
            </Link>
            <Link to="/staff/payment" className="flex items-center gap-2 rounded-2xl border border-stroke bg-surface p-3 text-sm font-medium hover:bg-surface2">
              <Icon name="wallet" className="h-5 w-5 text-peri" /> UPI settings
            </Link>
          </div>
          <Card className="p-0">
            <h2 className="px-4 pb-1 pt-4 font-display font-semibold">Recent activity</h2>
            {d.activity.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">Nothing yet today.</p>
            ) : (
              <ul className="divide-y divide-stroke">
                {d.activity.map((a) => {
                  const [icon, cls] = ACT_ICON[a.kind] || ['bell', 'text-muted'];
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Icon name={icon} className={`h-4 w-4 shrink-0 ${cls}`} />
                      <span className="flex-1">{a.message}</span>
                      <span className="shrink-0 text-xs text-muted">{ago(a.created_at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
