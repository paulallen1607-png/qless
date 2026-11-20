import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../lib/api.js';
import { copyText } from '../../lib/copy.js';
import { fileToDataUrl, rupees } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Card, ErrorBox, Field, Input, PageLoader, Sheet, TopBar } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

let rzpLoading = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!rzpLoading) {
    rzpLoading = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'https://checkout.razorpay.com/v1/checkout.js';
      sc.onload = () => resolve();
      sc.onerror = () => {
        rzpLoading = null;
        reject(new Error('Could not load Razorpay. Check your internet and try again.'));
      };
      document.head.appendChild(sc);
    });
  }
  return rzpLoading;
}

export default function Pay() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { active } = useOutletContext();
  const [order, setOrder] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [showQr, setShowQr] = useState(!isMobile());
  const [sheet, setSheet] = useState(false);
  const [ref, setRef] = useState('');
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [online, setOnline] = useState(null); // { provider, test_mode } when Razorpay is set up
  const [upiReady, setUpiReady] = useState(true);
  const [rzpBusy, setRzpBusy] = useState(false);

  useEffect(() => {
    api(`/orders/${id}`)
      .then((d) => {
        if (d.order.status !== 'awaiting_payment') nav(`/student/orders/${id}`, { replace: true });
        else {
          setOrder(d.order);
          setOnline(d.online_pay || null);
          setUpiReady(d.upi_ready !== false);
        }
      })
      .catch(setLoadErr);
  }, [id, nav]);

  async function pickShot(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setShot(await fileToDataUrl(f, 640, 0.6));
    } catch (x) {
      toast(x.message, 'error');
    }
  }

  async function submit(e) {
    e.preventDefault();
    const clean = ref.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(clean)) return setErr(new Error('Enter the 12-digit UPI reference / transaction ID from your payment app.'));
    setErr(null);
    setBusy(true);
    try {
      await api(`/orders/${id}/paid`, { method: 'POST', body: { upi_ref: clean, screenshot: shot || undefined } });
      active.refresh();
      toast(`Order #${order.token} placed! Waiting for staff to verify payment.`);
      nav(`/student/orders/${id}`, { replace: true });
    } catch (x) {
      setErr(x);
    } finally {
      setBusy(false);
    }
  }

  async function payOnline() {
    setRzpBusy(true);
    try {
      await loadRazorpay();
      const o = await api(`/orders/${id}/razorpay`, { method: 'POST' });
      const rzp = new window.Razorpay({
        key: o.key_id,
        order_id: o.rzp_order_id,
        amount: o.amount,
        currency: o.currency,
        name: o.name,
        description: o.description,
        prefill: o.prefill,
        theme: { color: '#C6FF4D' },
        modal: { ondismiss: () => setRzpBusy(false) },
        handler: async (resp) => {
          try {
            await api(`/orders/${id}/razorpay/verify`, { method: 'POST', body: resp });
            active.refresh();
            toast(`Paid! Order #${order.token} is confirmed and sent to the kitchen.`);
            nav(`/student/orders/${id}`, { replace: true });
          } catch (x) {
            toast(x.message, 'error');
            setRzpBusy(false);
          }
        },
      });
      rzp.on('payment.failed', (r) => {
        toast(r?.error?.description || 'Payment failed. Please try again.', 'error');
      });
      rzp.open();
    } catch (x) {
      toast(x.message, 'error');
      setRzpBusy(false);
    }
  }

  async function cancel() {
    try {
      await api(`/orders/${id}/cancel`, { method: 'POST' });
      active.refresh();
      toast('Order cancelled.', 'info');
      nav('/student', { replace: true });
    } catch (x) {
      toast(x.message, 'error');
    }
  }

  if (loadErr) return (<><TopBar title="Payment" back="/student" /><div className="p-4"><ErrorBox error={loadErr} /></div></>);
  if (!order) return <PageLoader />;

  const upi = order.upi;
  return (
    <>
      <TopBar title={online ? 'Payment' : 'Pay with UPI'} back="/student" subtitle={`Token #${order.token} reserved`} />
      <div className="space-y-4 px-4 pt-4">
        <Card className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Amount to pay</div>
          <div className="mt-1 font-display text-5xl font-bold">{rupees(order.total)}</div>
          {upiReady && <div className="mx-auto mt-3 flex max-w-full items-center gap-3 rounded-2xl bg-surface2 px-4 py-2 text-left">
            <Icon name="store" className="h-5 w-5 shrink-0 text-lime" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{upi.payee_name}</span>
              <span className="block break-all font-mono text-xs text-muted">{upi.upi_id}</span>
            </span>
          </div>}
          {upiReady && <div className="mt-2 text-xs text-muted">Note on payment: QLess Order {order.token}</div>}
        </Card>

        {online && (
          <>
            <button
              type="button"
              onClick={payOnline}
              disabled={rzpBusy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime text-lg font-semibold text-bg hover:brightness-105 disabled:opacity-60"
            >
              <Icon name="zap" className="h-5 w-5" /> {rzpBusy ? 'Opening payment…' : `Pay ${rupees(order.total)} online`}
            </button>
            <p className="-mt-2 text-center text-xs text-muted">
              UPI, cards or net banking via Razorpay · confirmed instantly, no waiting for staff
              {online.test_mode && (
                <span className="mt-2 block rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-left text-warn">
                  <b>Test mode:</b> no real money moves. Choose UPI and enter <b className="font-mono">success@razorpay</b> (or a test card shown by Razorpay).
                </span>
              )}
            </p>
            {upiReady && (
              <div className="flex items-center gap-3 py-1 text-xs text-muted">
                <span className="h-px flex-1 bg-stroke" /> or pay directly by UPI <span className="h-px flex-1 bg-stroke" />
              </div>
            )}
          </>
        )}

        {upiReady && (<>
        <a
          href={upi.link}
          className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-semibold hover:brightness-105 ${online ? 'border border-stroke bg-surface2 text-ink' : 'bg-lime text-bg'}`}
        >
          <Icon name="zap" className="h-5 w-5" /> Pay with UPI
        </a>
        <p className="-mt-2 text-center text-xs text-muted">Opens GPay, PhonePe, Paytm or any UPI app on your phone</p>

        <Card>
          <div className="text-sm font-medium">App didn't open, or it says “limit exceeded”? Pay manually</div>
          <p className="mt-1 text-xs text-muted">Some UPI apps block payment links to personal UPI IDs. Open GPay / PhonePe / Paytm yourself → “Pay to UPI ID” (or Pay contacts) → paste the ID and amount below. This normal payment usually works.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => toast((await copyText(upi.upi_id)) ? 'UPI ID copied' : `UPI ID: ${upi.upi_id}`, 'info')}
              className="flex items-center justify-center gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-sm"
            >
              <Icon name="copy" className="h-4 w-4 text-lime" /> Copy UPI ID
            </button>
            <button
              type="button"
              onClick={async () => toast((await copyText(order.total.toFixed(2))) ? 'Amount copied' : `Amount: ${order.total.toFixed(2)}`, 'info')}
              className="flex items-center justify-center gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-sm"
            >
              <Icon name="copy" className="h-4 w-4 text-lime" /> Copy {rupees(order.total)}
            </button>
          </div>
        </Card>

        <Card>
          <button className="flex w-full items-center justify-between" onClick={() => setShowQr((s) => !s)}>
            <span className="flex items-center gap-2 font-medium">
              <Icon name="qr" className="h-5 w-5 text-peri" /> Scan QR from another device
            </span>
            <Icon name="chevron" className={`h-4 w-4 text-muted transition ${showQr ? 'rotate-90' : ''}`} />
          </button>
          {showQr && (
            <div className="mt-4 flex flex-col items-center">
              <div className="rounded-3xl bg-white p-4">
                <QRCodeSVG value={upi.link} size={208} level="M" marginSize={0} />
              </div>
              <p className="mt-3 text-center text-xs text-muted">Scan with any UPI app. Amount and note are filled in for you.</p>
            </div>
          )}
        </Card>

        <Card className="border-peri/30 bg-peri/[.06]">
          <h2 className="font-display font-semibold">After paying</h2>
          <ol className="mt-2 space-y-1.5 text-sm text-muted">
            <li>1. Come back to this screen.</li>
            <li>2. Tap <b className="text-ink">I've paid</b> and enter the 12-digit UPI reference ID.</li>
            <li>3. Staff verifies it and your order goes to the kitchen.</li>
          </ol>
        </Card>

        <Button variant="peri" size="lg" className="w-full" onClick={() => setSheet(true)}>
          <Icon name="check" /> I've paid
        </Button>
        </>)}
        <button onClick={() => setCancelOpen(true)} className="block w-full py-2 text-center text-sm text-muted hover:text-bad">
          Cancel this order
        </button>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Confirm your payment">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="UPI reference / transaction ID" hint="12 digits. Find it in your UPI app under payment details (UTR / UPI Ref No).">
            <Input
              inputMode="numeric"
              autoFocus
              maxLength={14}
              placeholder="e.g. 412345678901"
              value={ref}
              onChange={(e) => setRef(e.target.value.replace(/[^\d\s]/g, ''))}
              className="font-mono text-lg tracking-widest"
            />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Payment screenshot (optional)</span>
            {shot ? (
              <div className="flex items-center gap-3">
                <img src={shot} alt="Payment screenshot" className="h-20 w-14 rounded-xl object-cover" />
                <button type="button" className="text-sm text-bad" onClick={() => setShot(null)}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-stroke text-sm text-muted hover:border-muted">
                <Icon name="upload" className="h-4 w-4" /> Upload screenshot
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickShot} />
              </label>
            )}
          </div>
          <ErrorBox error={err} />
          <Button type="submit" className="w-full" loading={busy}>
            Submit for verification
          </Button>
        </form>
      </Sheet>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel order?">
        <p className="text-sm text-muted">
          Only cancel if you haven't paid. If money was debited, tap “I've paid” instead and enter the reference ID.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>
            Keep order
          </Button>
          <Button variant="danger" onClick={cancel}>
            Cancel order
          </Button>
        </div>
      </Sheet>
    </>
  );
}
