import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartCtx = createContext(null);
const KEY = 'qless_cart';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && Array.isArray(v.lines) ? v : { lines: [], note: '' };
  } catch {
    return { lines: [], note: '' };
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }, [cart]);

  const value = useMemo(() => {
    const qtyOf = (id) => cart.lines.find((l) => l.id === id)?.qty || 0;
    const setQty = (item, qty) =>
      setCart((c) => {
        const q = Math.max(0, Math.min(20, qty));
        const rest = c.lines.filter((l) => l.id !== item.id);
        if (q === 0) return { ...c, lines: rest };
        const existing = c.lines.find((l) => l.id === item.id);
        const line = { id: item.id, name: item.name, price: item.price, veg: item.veg, image: item.image, qty: q };
        return { ...c, lines: existing ? c.lines.map((l) => (l.id === item.id ? line : l)) : [...c.lines, line] };
      });
    return {
      lines: cart.lines,
      note: cart.note,
      count: cart.lines.reduce((s, l) => s + l.qty, 0),
      total: cart.lines.reduce((s, l) => s + l.qty * l.price, 0),
      qtyOf,
      add: (item) => setQty(item, qtyOf(item.id) + 1),
      remove: (item) => setQty(item, qtyOf(item.id) - 1),
      setQty,
      setNote: (note) => setCart((c) => ({ ...c, note })),
      /** Refresh names/prices from the live menu; drop deleted items. */
      sync: (menu) =>
        setCart((c) => ({
          ...c,
          lines: c.lines
            .map((l) => {
              const m = menu.find((x) => x.id === l.id);
              return m ? { ...l, name: m.name, price: m.price, image: m.image, veg: m.veg } : null;
            })
            .filter(Boolean),
        })),
      clear: () => setCart({ lines: [], note: '' }),
    };
  }, [cart]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);
