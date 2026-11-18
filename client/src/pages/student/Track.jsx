import { Link, useParams } from 'react-router-dom';
import { usePoll } from '../../lib/usePoll.js';
import { dateTime, minutes, rupees, time } from '../../lib/format.js';
import { Card, ErrorBox, PageLoader, StatusPill, TopBar, VegDot } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';

const STEPS = [
  ['pending_payment', 'Payment pending', 'paid_at'],
  ['confirmed', 'Confirmed', 'confirmed_at'],
  ['preparing', 'Preparing', 'preparing_at'],
  ['ready', 'Ready', 'ready_at'],
  ['collected', 'Collected', 'collected_at'],
];

function Stepper({ order }) {
  const idx = STEPS.findIndex(([s]) => s === order.status);
  return (
    <ol className="relative space-y-0">
      {STEPS.map(([s, label, at], i) => {
        const done = i < idx || order.status === 'collected';
        const current = i === idx && order.status !== 'collected';
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < STEPS.length - 1 && (
              <span className={`absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5 ${done ? 'bg-lime' : 'bg-stroke'}`} />
            )}
            <span
              className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                done ? 'border-lime bg-lime text-bg' : current ? 'animate-ring border-lime bg-bg text-lime' : 'border-stroke bg-bg text-muted'
              }`}
            >
              {done ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <div className="flex flex-1 items-center justify-between pt-0.5">
              <span className={current ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-muted'}>{label}</span>
              <span className="text-xs text-muted">{order[at] ? time(order[at]) : ''}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function Track() {
  const { id } = useParams();
  const { data, error, loading, refresh } = usePoll(`/orders/${id}`, 4000);
  const order = data?.order;

  if (loading && !data) return (<><TopBar title="Order" back="/student/orders" /><PageLoader /></>);
  if (!order) return (<><TopBar title="Order" back="/student/orders" /><div className="p-4"><ErrorBox error={error} onRetry={refresh} /></div></>);

  const q = order.queue || {};
  const ready = order.status === 'ready';
  const called = ready && q.now_serving === order.token;
  const live = ['pending_payment', 'confirmed', 'preparing'].includes(order.status);

  return (
    <>
      <TopBar
        title={`Order #${order.token}`}
        back="/student/orders"
        subtitle={dateTime(order.created_at)}
        right={
          <Link to={`/student/receipt/${order.id}`} className="grid h-10 w-10 place-items-center rounded-full border border-stroke bg-surface" aria-label="Receipt">
            <Icon name="receipt" className="h-5 w-5" />
          </Link>
        }
      />
      <div className="space-y-4 px-4 pt-4">
        <Card className={`text-center ${ready ? 'border-lime/60 bg-lime/[.07]' : ''}`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Your token</div>
          <div className="font-display text-7xl font-bold leading-none text-lime">#{order.token}</div>
          <StatusPill status={order.status} className="mt-3" />
          {ready && (
            <div className="mt-4 rounded-2xl bg-lime px-4 py-3 font-semibold text-bg">
              {called ? '📣 Your token is being called — go to the counter now!' : '🎉 Your order is ready! Show this token at the counter.'}
            </div>
          )}
          {order.status === 'rejected' && (
            <div className="mt-4 rounded-2xl border border-bad/30 bg-bad/10 p-3 text-left text-sm text-bad">
              <div className="font-semibold">Payment could not be verified</div>
              <div className="mt-1">Reason: {order.reject_reason}</div>
              <div className="mt-1 text-bad/80">If money was debited, show your UPI reference {order.upi_ref} at the counter.</div>
            </div>
          )}
          {live && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-surface2 p-3">
                <div className="font-display text-xl font-semibold">{q.now_serving ? `#${q.now_serving}` : '—'}</div>
                <div className="text-[11px] text-muted">Now serving</div>
              </div>
              <div className="rounded-2xl bg-surface2 p-3">
                <div className="font-display text-xl font-semibold">{q.people_ahead}</div>
                <div className="text-[11px] text-muted">People ahead</div>
              </div>
              <div className="rounded-2xl bg-surface2 p-3">
                <div className="font-display text-xl font-semibold">~{minutes(q.eta_minutes)}</div>
                <div className="text-[11px] text-muted">Est. wait</div>
              </div>
            </div>
          )}
          {live && (
            <p className="mt-3 text-xs text-muted">
              Wait = people ahead × avg service time ({minutes(q.avg_service_minutes)}). Updates live.
            </p>
          )}
        </Card>

        {order.status !== 'rejected' && (
          <Card>
            <Stepper order={order} />
          </Card>
        )}

        <Card>
          <h2 className="mb-2 font-display font-semibold">Items</h2>
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <VegDot veg={it.veg} /> {it.qty} × {it.name}
              </span>
              <span>{rupees(it.qty * it.price)}</span>
            </div>
          ))}
          {order.note && (
            <div className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-sm text-muted">
              Note: <span className="text-ink">{order.note}</span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-dashed border-stroke pt-3">
            <span className="font-semibold">Total paid</span>
            <span className="font-display text-lg font-bold">{rupees(order.total)}</span>
          </div>
          <div className="mt-2 text-xs text-muted">
            UPI ref: <span className="font-mono text-ink">{order.upi_ref || '—'}</span>
          </div>
        </Card>

        <Link to={`/student/receipt/${order.id}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-stroke bg-surface font-medium">
          <Icon name="printer" className="h-5 w-5" /> View receipt
        </Link>
      </div>
    </>
  );
}
