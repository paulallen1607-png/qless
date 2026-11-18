import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePoll } from '../../lib/usePoll.js';
import { itemCount, rupees, shortDate, time } from '../../lib/format.js';
import { Button, Chip, Empty, ErrorBox, PageLoader, StatusPill, TopBar } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';

const ACTIVE = ['awaiting_payment', 'pending_payment', 'confirmed', 'preparing', 'ready'];

export default function Orders() {
  const { data, error, loading, refresh } = usePoll('/orders/mine', 8000);
  const [tab, setTab] = useState('all');
  const orders = (data?.orders || []).filter((o) =>
    tab === 'active' ? ACTIVE.includes(o.status) : tab === 'past' ? !ACTIVE.includes(o.status) : true
  );

  return (
    <>
      <TopBar title="My orders" />
      <div className="flex gap-2 px-4 pt-3">
        {[['all', 'All'], ['active', 'Active'], ['past', 'Past']].map(([k, l]) => (
          <Chip key={k} active={tab === k} onClick={() => setTab(k)}>
            {l}
          </Chip>
        ))}
      </div>
      <div className="space-y-3 px-4 pt-4">
        <ErrorBox error={error} onRetry={refresh} />
        {loading && !data ? (
          <PageLoader />
        ) : orders.length === 0 ? (
          <Empty
            icon="receipt"
            title="No orders here"
            text="When you order, your tokens and receipts appear here."
            action={<Link to="/student/menu"><Button>Order food</Button></Link>}
          />
        ) : (
          orders.map((o) => {
            const to = o.status === 'awaiting_payment' ? `/student/pay/${o.id}` : `/student/orders/${o.id}`;
            return (
              <div key={o.id} className="rounded-3xl border border-stroke bg-surface p-4">
                <Link to={to} className="flex items-start gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface2 font-display text-lg font-bold text-lime">#{o.token}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={o.status} />
                      <span className="font-display font-semibold">{rupees(o.total)}</span>
                    </div>
                    <div className="mt-1.5 truncate text-sm">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {shortDate(o.created_at)}, {time(o.created_at)} · {itemCount(o.items)} items
                    </div>
                  </div>
                </Link>
                {o.status !== 'awaiting_payment' && (
                  <div className="mt-3 flex gap-2 border-t border-stroke pt-3">
                    <Link to={to} className="flex-1 rounded-xl bg-surface2 py-2 text-center text-sm font-medium">
                      {ACTIVE.includes(o.status) ? 'Track' : 'Details'}
                    </Link>
                    <Link to={`/student/receipt/${o.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface2 py-2 text-sm font-medium">
                      <Icon name="printer" className="h-4 w-4" /> Receipt
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
