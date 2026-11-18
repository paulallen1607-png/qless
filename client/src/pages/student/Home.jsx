import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePoll } from '../../lib/usePoll.js';
import { Button, Card, Empty, ErrorBox, Logo, Spinner, StatusPill } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';
import { greeting, itemCount, minutes, rupees, shortDate, time } from '../../lib/format.js';

export function ActiveOrderCard({ order, nowServing }) {
  const q = order.queue || {};
  const isCalled = nowServing === order.token && order.status === 'ready';
  const awaiting = order.status === 'awaiting_payment';
  return (
    <Link
      to={awaiting ? `/student/pay/${order.id}` : `/student/orders/${order.id}`}
      className={`block overflow-hidden rounded-3xl border p-5 transition ${
        order.status === 'ready' ? 'border-lime/60 bg-lime/[.07]' : 'border-stroke bg-surface hover:bg-surface2'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Your token</div>
          <div className="font-display text-5xl font-bold leading-tight text-lime">#{order.token}</div>
        </div>
        <StatusPill status={order.status} />
      </div>
      {awaiting ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn">
          <span>Finish paying {rupees(order.total)} to place this order</span>
          <Icon name="chevron" className="h-4 w-4" />
        </div>
      ) : order.status === 'ready' ? (
        <p className="mt-3 rounded-2xl bg-lime px-4 py-3 text-sm font-semibold text-bg">
          {isCalled ? 'Your token is being called — head to the counter!' : 'Ready! Collect it at the counter.'}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface2 p-2.5">
            <div className="font-display text-lg font-semibold">{nowServing ? `#${nowServing}` : '—'}</div>
            <div className="text-[11px] text-muted">Now serving</div>
          </div>
          <div className="rounded-2xl bg-surface2 p-2.5">
            <div className="font-display text-lg font-semibold">{q.people_ahead ?? '—'}</div>
            <div className="text-[11px] text-muted">Ahead of you</div>
          </div>
          <div className="rounded-2xl bg-surface2 p-2.5">
            <div className="font-display text-lg font-semibold">~{minutes(q.eta_minutes)}</div>
            <div className="text-[11px] text-muted">Est. wait</div>
          </div>
        </div>
      )}
      {order.status === 'pending_payment' && (
        <p className="mt-3 text-xs text-muted">Staff is checking your UPI payment. This usually takes a minute.</p>
      )}
    </Link>
  );
}

export default function StudentHome() {
  const { user } = useAuth();
  const { active } = useOutletContext();
  const recent = usePoll('/orders/mine', 15000);
  const nav = useNavigate();
  const accepting = active.data?.accepting_orders ?? true;
  const activeOrders = active.data?.orders || [];
  const past = (recent.data?.orders || []).filter((o) => ['collected', 'rejected'].includes(o.status)).slice(0, 4);

  return (
    <div className="px-4 pt-5">
      <div className="flex items-center justify-between">
        <Logo size="text-xl" />
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            accepting ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${accepting ? 'bg-ok' : 'bg-warn'}`} />
          {accepting ? 'Open' : 'Paused'}
        </span>
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold">
        {greeting()}, {user.name.split(' ')[0]} 👋
      </h1>
      <p className="mt-1 text-sm text-muted">What are we eating today?</p>

      <section className="mt-6 space-y-3">
        {active.loading && !active.data ? (
          <div className="grid h-40 place-items-center rounded-3xl border border-stroke bg-surface">
            <Spinner className="h-6 w-6 text-lime" />
          </div>
        ) : (
          activeOrders.map((o) => <ActiveOrderCard key={o.id} order={o} nowServing={active.data.now_serving} />)
        )}
        <ErrorBox error={active.error} onRetry={active.refresh} />
      </section>

      <Button size="lg" className="mt-4 w-full" disabled={!accepting} onClick={() => nav('/student/menu')}>
        <Icon name="utensils" /> Order Food
      </Button>
      {!accepting && (
        <p className="mt-2 text-center text-sm text-warn">The canteen has paused orders for a bit. Check back soon.</p>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent orders</h2>
          <Link to="/student/orders" className="text-sm text-lime">
            See all
          </Link>
        </div>
        {recent.loading && !recent.data ? (
          <div className="py-8 text-center text-muted">
            <Spinner className="mx-auto h-5 w-5" />
          </div>
        ) : past.length === 0 ? (
          <Card>
            <Empty icon="receipt" title="No orders yet" text="Your past orders and receipts will show up here." />
          </Card>
        ) : (
          <Card className="divide-y divide-stroke p-0">
            {past.map((o) => (
              <Link key={o.id} to={`/student/receipt/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2/60">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface2 font-display font-semibold">#{o.token}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{o.items.map((i) => i.name).join(', ')}</div>
                  <div className="text-xs text-muted">
                    {shortDate(o.created_at)} · {time(o.created_at)} · {itemCount(o.items)} items
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{rupees(o.total)}</div>
                  <StatusPill status={o.status} className="mt-1 !px-2 !py-0.5 !text-[10px]" />
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
