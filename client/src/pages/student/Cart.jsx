import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { rupees } from '../../lib/format.js';
import { Button, Card, Empty, ErrorBox, FoodImage, Textarea, TopBar, VegDot } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';
import { QtyControl } from './Menu.jsx';

export default function Cart() {
  const cart = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const { active } = useOutletContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const accepting = active.data?.accepting_orders ?? true;

  async function checkout() {
    setError(null);
    setBusy(true);
    try {
      const d = await api('/orders', {
        method: 'POST',
        body: { items: cart.lines.map((l) => ({ id: l.id, qty: l.qty })), note: cart.note },
      });
      cart.clear();
      active.refresh();
      toast(`Token #${d.order.token} reserved. Complete the UPI payment.`, 'info');
      nav(`/student/pay/${d.order.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!cart.lines.length) {
    return (
      <>
        <TopBar title="Your cart" back="/student/menu" />
        <Empty
          icon="bag"
          title="Your cart is empty"
          text="Add something tasty from the menu."
          action={<Button onClick={() => nav('/student/menu')}>Browse menu</Button>}
        />
      </>
    );
  }

  return (
    <>
      <TopBar title="Your cart" back="/student/menu" subtitle={`${cart.count} item${cart.count > 1 ? 's' : ''}`} />
      <div className="space-y-4 px-4 pt-4">
        <Card className="divide-y divide-stroke p-0">
          {cart.lines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3">
              <FoodImage src={l.image} name={l.name} className="h-14 w-14 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <VegDot veg={l.veg} />
                  <span className="truncate text-sm font-semibold">{l.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {rupees(l.price)} × {l.qty} = <span className="text-ink">{rupees(l.price * l.qty)}</span>
                </div>
              </div>
              <QtyControl compact qty={l.qty} onAdd={() => cart.add(l)} onRemove={() => cart.remove(l)} />
            </div>
          ))}
        </Card>

        <button onClick={() => nav('/student/menu')} className="flex items-center gap-2 text-sm font-medium text-lime">
          <Icon name="plus" className="h-4 w-4" /> Add more items
        </button>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted" htmlFor="note">
            Note for the kitchen (optional)
          </label>
          <Textarea
            id="note"
            maxLength={140}
            placeholder="e.g. less spicy, no onion"
            value={cart.note}
            onChange={(e) => cart.setNote(e.target.value)}
          />
          <div className="mt-1 text-right text-xs text-muted">{cart.note.length}/140</div>
        </div>

        <Card>
          <h2 className="mb-3 font-display font-semibold">Order summary</h2>
          {cart.lines.map((l) => (
            <div key={l.id} className="flex justify-between py-1 text-sm">
              <span className="text-muted">
                {l.qty} × {l.name}
              </span>
              <span>{rupees(l.qty * l.price)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-dashed border-stroke pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-display text-xl font-bold text-lime">{rupees(cart.total)}</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Icon name="wallet" className="h-3.5 w-3.5" /> Pay by UPI · GPay, PhonePe, Paytm or any UPI app
          </p>
        </Card>

        <ErrorBox error={error} />
        {!accepting && <p className="text-center text-sm text-warn">The canteen has paused orders. Try again shortly.</p>}
        <Button size="lg" className="w-full" loading={busy} disabled={!accepting} onClick={checkout}>
          Proceed to pay {rupees(cart.total)}
        </Button>
      </div>
    </>
  );
}
