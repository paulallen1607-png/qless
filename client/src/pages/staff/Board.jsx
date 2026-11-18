import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { usePoll } from '../../lib/usePoll.js';
import { api } from '../../lib/api.js';
import { copyText } from '../../lib/copy.js';
import { ago, rupees, time } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Chip, Empty, ErrorBox, Field, PageLoader, Sheet, StatusPill, Textarea, TopBar, VegDot } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';
import { QueueControls } from './Dashboard.jsx';

const TABS = [
  ['pending', 'Pending Payment'],
  ['preparing', 'Preparing'],
  ['ready', 'Ready'],
  ['completed', 'Completed'],
];

const REASONS = ['Payment not received', 'Amount does not match', 'Invalid UPI reference', 'Duplicate payment reference'];

function OrderCard({ o, nowServing, act, busy, onReject, onShot }) {
  const toast = useToast();
  const isBusy = (k) => busy === `${o.id}:${k}`;
  const serving = nowServing === o.token;
  return (
    <article className={`rounded-3xl border bg-surface p-4 ${serving ? 'border-lime/60' : 'border-stroke'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-14 w-14 place-items-center rounded-2xl font-display text-xl font-bold ${serving ? 'bg-lime text-bg' : 'bg-surface2 text-lime'}`}>
            #{o.token}
          </div>
          <div>
            <div className="font-semibold">{o.student?.name || 'Student'}</div>
            <div className="text-xs text-muted">
              {o.student?.student_id} · {time(o.paid_at || o.created_at)} · {ago(o.paid_at || o.created_at)}
            </div>
          </div>
        </div>
        <StatusPill status={o.status} />
      </div>

      <ul className="mt-3 space-y-1 rounded-2xl bg-surface2 p-3 text-sm">
        {o.items.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            <VegDot veg={it.veg} />
            <span className="font-display font-semibold">{it.qty}×</span>
            <span className="flex-1">{it.name}</span>
          </li>
        ))}
        {o.note && <li className="mt-1 border-t border-stroke pt-2 text-warn">Note: {o.note}</li>}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-display text-lg font-bold">{rupees(o.total)}</span>
        <span className="flex items-center gap-2">
          <span className="text-muted">UPI ref</span>
          <button
            className="flex items-center gap-1 rounded-lg bg-surface2 px-2 py-1 font-mono text-xs"
            onClick={async () => toast((await copyText(o.upi_ref)) ? 'UPI reference copied' : `UPI ref: ${o.upi_ref}`, 'info')}
            title="Copy"
          >
            {o.upi_ref} <Icon name="copy" className="h-3 w-3 text-muted" />
          </button>
          {o.screenshot && (
            <button onClick={() => onShot(o.screenshot)} className="rounded-lg bg-peri/15 px-2 py-1 text-xs font-medium text-peri">
              Screenshot
            </button>
          )}
        </span>
      </div>
      {o.status === 'rejected' && <p className="mt-2 text-sm text-bad">Rejected: {o.reject_reason}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {o.status === 'pending_payment' && (
          <>
            <Button size="sm" variant="ok" className="flex-1" loading={isBusy('confirm')} onClick={() => act(o, 'confirm')}>
              <Icon name="check" className="h-4 w-4" /> Confirm payment
            </Button>
            <Button size="sm" variant="danger" onClick={() => onReject(o)}>
              Reject
            </Button>
          </>
        )}
        {o.status === 'confirmed' && (
          <Button size="sm" variant="peri" className="flex-1" loading={isBusy('preparing')} onClick={() => act(o, 'preparing')}>
            <Icon name="chef" className="h-4 w-4" /> Mark Preparing
          </Button>
        )}
        {(o.status === 'confirmed' || o.status === 'preparing') && (
          <Button size="sm" className="flex-1" loading={isBusy('ready')} onClick={() => act(o, 'ready')}>
            <Icon name="bell" className="h-4 w-4" /> Mark Ready
          </Button>
        )}
        {o.status === 'ready' && (
          <Button size="sm" variant="ok" className="flex-1" loading={isBusy('collected')} onClick={() => act(o, 'collected')}>
            <Icon name="check" className="h-4 w-4" /> Mark Collected
          </Button>
        )}
        {['confirmed', 'preparing', 'ready'].includes(o.status) && (
          <Link
            to={`/staff/ticket/${o.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-stroke bg-surface2 px-3 text-sm"
          >
            <Icon name="printer" className="h-4 w-4" /> Ticket
          </Link>
        )}
      </div>
    </article>
  );
}

let lastTab = 'pending';

export default function Board() {
  const { data, error, loading, refresh } = usePoll('/staff/orders', 4000);
  const { dash } = useOutletContext();
  const toast = useToast();
  const [tab, setTabState] = useState(lastTab);
  const setTab = (t) => {
    lastTab = t;
    setTabState(t);
  };
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [shot, setShot] = useState(null);

  async function act(o, kind) {
    setBusy(`${o.id}:${kind}`);
    try {
      if (kind === 'confirm') await api(`/staff/orders/${o.id}/confirm`, { method: 'POST' });
      else await api(`/staff/orders/${o.id}/status`, { method: 'POST', body: { status: kind } });
      const msg = { confirm: 'Payment confirmed', preparing: 'Marked preparing', ready: 'Marked ready — student notified', collected: 'Marked collected' }[kind];
      toast(`#${o.token}: ${msg}`, kind === 'ready' ? 'ready' : 'success');
      refresh();
      dash.refresh();
    } catch (e) {
      toast(e.message, 'error');
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reject(e) {
    e.preventDefault();
    if (reason.trim().length < 3) return toast('Add a short reason for the student.', 'error');
    try {
      await api(`/staff/orders/${rejecting.id}/reject`, { method: 'POST', body: { reason } });
      toast(`#${rejecting.token}: payment rejected`, 'info');
      setRejecting(null);
      setReason('');
      refresh();
      dash.refresh();
    } catch (x) {
      toast(x.message, 'error');
    }
  }

  const list = data?.tabs?.[tab] || [];

  return (
    <>
      <TopBar
        title="Live orders"
        subtitle={data ? `Now serving ${data.now_serving ? '#' + data.now_serving : '—'} · Next ${data.next_in_line ? '#' + data.next_in_line : '—'}` : 'Today'}
      />
      <div className="px-4 pt-3">
        <QueueControls onDone={() => { refresh(); dash.refresh(); }} size="sm" />
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {TABS.map(([k, l]) => (
            <Chip key={k} active={tab === k} onClick={() => setTab(k)}>
              {l}
              <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === k ? 'bg-bg/15' : 'bg-surface2'}`}>{data?.tabs?.[k]?.length ?? 0}</span>
            </Chip>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4">
        <ErrorBox error={error} onRetry={refresh} />
        {loading && !data ? (
          <PageLoader />
        ) : list.length === 0 ? (
          <Empty
            icon={tab === 'pending' ? 'wallet' : tab === 'completed' ? 'check' : 'chef'}
            title={{ pending: 'No payments to verify', preparing: 'Kitchen is clear', ready: 'Nothing waiting for pickup', completed: 'No completed orders yet' }[tab]}
            text="New orders show up here automatically."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((o) => (
              <OrderCard key={o.id} o={o} nowServing={data.now_serving} act={act} busy={busy} onReject={setRejecting} onShot={setShot} />
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!rejecting} onClose={() => setRejecting(null)} title={rejecting ? `Reject payment #${rejecting.token}` : ''}>
        <form onSubmit={reject} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          <Field label="Reason (shown to the student)">
            <Textarea maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No payment with this reference" />
          </Field>
          <Button type="submit" variant="danger" className="w-full">
            Reject payment
          </Button>
        </form>
      </Sheet>
      <Sheet open={!!shot} onClose={() => setShot(null)} title="Payment screenshot">
        {shot && <img src={shot} alt="Payment screenshot" className="mx-auto max-h-[70dvh] rounded-2xl" />}
      </Sheet>
    </>
  );
}
