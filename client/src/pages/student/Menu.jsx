import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { usePoll } from '../../lib/usePoll.js';
import { useCart } from '../../context/CartContext.jsx';
import { Chip, Empty, ErrorBox, FoodImage, PageLoader, VegDot } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';
import { rupees } from '../../lib/format.js';

export function QtyControl({ qty, onAdd, onRemove, disabled, compact }) {
  if (!qty) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className={`inline-flex items-center justify-center gap-1 rounded-xl bg-lime font-semibold text-bg transition hover:brightness-105 disabled:bg-stroke disabled:text-muted ${
          compact ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm'
        }`}
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.6} /> Add
      </button>
    );
  }
  return (
    <div className={`inline-flex items-center rounded-xl border border-lime/50 bg-lime/10 ${compact ? 'h-8' : 'h-9'}`}>
      <button type="button" onClick={onRemove} className="grid h-full w-9 place-items-center text-lime" aria-label="Remove one">
        <Icon name="minus" className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="min-w-6 text-center font-display font-semibold tabular-nums">{qty}</span>
      <button type="button" onClick={onAdd} disabled={disabled || qty >= 20} className="grid h-full w-9 place-items-center text-lime disabled:opacity-40" aria-label="Add one">
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}

export function CartBar() {
  const cart = useCart();
  const nav = useNavigate();
  if (!cart.count) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-[480px] px-4">
      <button
        onClick={() => nav('/student/cart')}
        className="animate-toast flex h-14 w-full items-center justify-between rounded-2xl bg-lime px-5 text-bg shadow-xl shadow-lime/10"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="bag" className="h-5 w-5" />
          {cart.count} item{cart.count > 1 ? 's' : ''} · {rupees(cart.total)}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          View cart <Icon name="chevron" className="h-4 w-4" strokeWidth={2.6} />
        </span>
      </button>
    </div>
  );
}

export default function Menu() {
  const { data, error, loading, refresh } = usePoll('/menu', 15000);
  const { active } = useOutletContext();
  const cart = useCart();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const accepting = active.data?.accepting_orders ?? true;

  useEffect(() => {
    if (data?.items) cart.sync(data.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.items || []).filter(
      (i) =>
        (cat === 'All' || i.category === cat) &&
        (!term || i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term))
    );
  }, [data, q, cat]);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-bg/95 px-4 pb-3 pt-5 backdrop-blur">
        <h1 className="font-display text-2xl font-bold">Food Menu</h1>
        <div className="relative mt-3">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dosa, chai, biryani…"
            className="h-12 w-full rounded-2xl border border-stroke bg-surface pl-12 pr-4 outline-none placeholder:text-muted/70 focus:border-lime/60"
          />
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {['All', ...(data?.categories || ['Meals', 'Snacks', 'Beverages', 'Breakfast', 'Desserts'])].map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <div className="px-4 pb-20">
        {!accepting && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            <Icon name="pause" className="h-4 w-4" /> Ordering is paused right now. You can still browse.
          </div>
        )}
        <ErrorBox error={error} onRetry={refresh} />
        {loading && !data ? (
          <PageLoader label="Loading menu…" />
        ) : items.length === 0 ? (
          <Empty icon="search" title="Nothing matches" text={q ? `No items for “${q}”.` : 'No items in this category yet.'} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it) => {
              const qty = cart.qtyOf(it.id);
              return (
                <article key={it.id} className={`flex flex-col overflow-hidden rounded-3xl border border-stroke bg-surface ${it.available ? '' : 'opacity-60'}`}>
                  <div className="relative">
                    <FoodImage src={it.image} name={it.name} className="aspect-[4/3] w-full" />
                    {!it.available && (
                      <span className="absolute left-2 top-2 rounded-full bg-bad px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                        Unavailable
                      </span>
                    )}
                    {it.available && it.stock != null && it.stock <= 5 && (
                      <span className="absolute left-2 top-2 rounded-full bg-warn px-2.5 py-1 text-[11px] font-bold text-bg">Only {it.stock} left</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-start gap-1.5">
                      <VegDot veg={it.veg} className="mt-0.5" />
                      <h3 className="text-sm font-semibold leading-tight">{it.name}</h3>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{it.description}</p>
                    <div className="mt-auto flex items-center justify-between gap-1 pt-3">
                      <span className="font-display font-semibold">{rupees(it.price)}</span>
                      <QtyControl
                        compact
                        qty={qty}
                        disabled={!it.available || !accepting || (it.stock != null && qty >= it.stock)}
                        onAdd={() => cart.add(it)}
                        onRemove={() => cart.remove(it)}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <CartBar />
    </div>
  );
}
