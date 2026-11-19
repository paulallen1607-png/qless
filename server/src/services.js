import { all, one, run, getSettings, logActivity } from './db.js';
import { dateKey, ACTIVE_STATUSES } from './util.js';

// ---------------- Menu ----------------

/** Reset daily stock for items whose stock was set on an earlier day. */
export function refreshDailyStock() {
  const today = dateKey();
  run(
    `UPDATE menu_items
       SET stock = daily_stock,
           available = CASE WHEN auto_soldout = 1 THEN 1 ELSE available END,
           auto_soldout = 0,
           stock_date = ?
     WHERE daily_stock IS NOT NULL AND (stock_date IS NULL OR stock_date <> ?)`,
    today,
    today
  );
}

export function serializeItem(r) {
  if (!r) return null;
  const soldOut = r.stock !== null && r.stock <= 0;
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    category: r.category,
    veg: !!r.veg,
    description: r.description,
    image: r.image,
    prep_time: r.prep_time,
    available: !!r.available && !soldOut,
    manual_available: !!r.available,
    stock: r.stock,
    daily_stock: r.daily_stock,
  };
}

export function listMenu() {
  refreshDailyStock();
  return all('SELECT * FROM menu_items ORDER BY category, name').map(serializeItem);
}

/** Give stock back when an order is cancelled or its payment is rejected. */
export function restoreStock(items) {
  for (const it of items) {
    const row = one('SELECT * FROM menu_items WHERE id = ?', it.id);
    if (!row || row.stock === null) continue;
    const newStock = row.stock + it.qty;
    const reenable = row.auto_soldout && newStock > 0;
    run(
      'UPDATE menu_items SET stock = ?, available = ?, auto_soldout = ? WHERE id = ?',
      newStock,
      reenable ? 1 : row.available,
      reenable ? 0 : row.auto_soldout,
      row.id
    );
  }
}

// ---------------- Orders & queue ----------------

export const STATUS_LABEL = {
  awaiting_payment: 'Awaiting payment',
  pending_payment: 'Payment pending verification',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  collected: 'Collected',
  rejected: 'Payment rejected',
  cancelled: 'Cancelled',
};

export function buildUpiLink({ upiId, payeeName, amount, token }) {
  const params = [
    `pa=${upiId}`,
    `pn=${encodeURIComponent(payeeName)}`,
    amount != null ? `am=${Number(amount).toFixed(2)}` : null,
    'cu=INR',
    token != null ? `tn=${encodeURIComponent(`QLess Order ${token}`)}` : null,
  ].filter(Boolean);
  return `upi://pay?${params.join('&')}`;
}

/**
 * Average service time (minutes) from real data: how long the kitchen takes per
 * order, from "started" (preparing, or confirmed if skipped) to "ready", over the
 * last 50 orders that reached ready. Falls back to 5 minutes when there is no data.
 */
export function avgServiceMinutes() {
  const rows = all(
    `SELECT ready_at - COALESCE(preparing_at, confirmed_at) AS d
       FROM orders
      WHERE ready_at IS NOT NULL AND COALESCE(preparing_at, confirmed_at) IS NOT NULL
      ORDER BY ready_at DESC LIMIT 50`
  ).filter((r) => r.d > 0 && r.d < 90 * 60000);
  if (!rows.length) return 5;
  const avg = rows.reduce((s, r) => s + r.d, 0) / rows.length / 60000;
  return Math.min(30, Math.max(1, Math.round(avg * 10) / 10));
}

export function nowServing() {
  const s = getSettings();
  return s.now_serving_date === dateKey() ? s.now_serving_token : null;
}

export function queueInfo(order, avg = avgServiceMinutes()) {
  const today = dateKey();
  const serving = nowServing();
  if (order.order_date !== today || !ACTIVE_STATUSES.includes(order.status)) {
    return { people_ahead: 0, eta_minutes: 0, now_serving: serving, avg_service_minutes: avg };
  }
  const ahead = one(
    `SELECT COUNT(*) AS n FROM orders
      WHERE order_date = ? AND token < ? AND status IN ('pending_payment','confirmed','preparing')`,
    today,
    order.token
  ).n;
  // Estimated wait = people ahead × average service time (at least one service slot for our own order).
  const eta = order.status === 'ready' ? 0 : Math.round(Math.max(ahead, 1) * avg);
  return { people_ahead: ahead, eta_minutes: eta, now_serving: serving, avg_service_minutes: avg };
}

export function serializeOrder(o, { withStudent = false, withQueue = false, settings } = {}) {
  if (!o) return null;
  const s = settings || getSettings();
  const out = {
    id: o.id,
    token: o.token,
    order_date: o.order_date,
    items: JSON.parse(o.items_json),
    total: o.total,
    note: o.note,
    status: o.status,
    status_label: STATUS_LABEL[o.status] || o.status,
    payment_status: o.payment_status,
    payment_method: 'UPI',
    upi_ref: o.upi_ref,
    screenshot: o.screenshot,
    reject_reason: o.reject_reason,
    created_at: o.created_at,
    paid_at: o.paid_at,
    confirmed_at: o.confirmed_at,
    preparing_at: o.preparing_at,
    ready_at: o.ready_at,
    collected_at: o.collected_at,
    called_at: o.called_at,
    skipped_at: o.skipped_at,
  };
  if (o.status === 'awaiting_payment') {
    out.upi = {
      upi_id: s.upi_id,
      payee_name: s.canteen_name,
      link: buildUpiLink({ upiId: s.upi_id, payeeName: s.canteen_name, amount: o.total, token: o.token }),
    };
  }
  if (withStudent) {
    const u = one('SELECT name, COALESCE(student_id, email) AS student_id, email, dept, year FROM users WHERE id = ?', o.student_id);
    out.student = u ? { ...u } : null;
  }
  if (withQueue) out.queue = queueInfo(o);
  return out;
}

/** Cancel unpaid drafts older than 30 minutes and release their stock. */
export function expireStaleDrafts() {
  const cutoff = Date.now() - 30 * 60000;
  const stale = all("SELECT * FROM orders WHERE status = 'awaiting_payment' AND created_at < ?", cutoff);
  for (const o of stale) {
    run("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", Date.now(), o.id);
    restoreStock(JSON.parse(o.items_json));
  }
}

/** Next order to call: oldest token first; skipped tokens go to the back of the line. */
export function nextInLine() {
  return one(
    `SELECT * FROM orders
      WHERE order_date = ? AND status IN ('confirmed','preparing','ready') AND called_at IS NULL
      ORDER BY (skipped_at IS NOT NULL), skipped_at, token LIMIT 1`,
    dateKey()
  );
}

export function callNext() {
  const next = nextInLine();
  if (!next) return null;
  const now = Date.now();
  run('UPDATE orders SET called_at = ?, updated_at = ? WHERE id = ?', now, now, next.id);
  run('UPDATE settings SET now_serving_token = ?, now_serving_date = ? WHERE id = 1', next.token, next.order_date);
  logActivity('call', `Called token #${next.token}`);
  return next;
}
