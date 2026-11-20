import { createRouter, saveDataUrlImage, deleteUpload } from './http.js';
import { all, one, run, tx, getSettings, logActivity } from './db.js';
import {
  hashPassword, verifyPassword, signJwt, publicUser, requireRole,
  checkThrottle, noteFailure, clearFailures,
} from './auth.js';
import {
  listMenu, serializeItem, refreshDailyStock, restoreStock, serializeOrder, queueInfo,
  avgServiceMinutes, nowServing, nextInLine, callNext, expireStaleDrafts, buildUpiLink,
} from './services.js';
import {
  HttpError, bad, str, RE, CATEGORIES, ACTIVE_STATUSES, money, dateKey, hourOf, lastNDays,
} from './util.js';
import crypto from 'node:crypto';
import { sendOtpEmail, emailConfigured } from './email.js';
import { razorpayConfigured, razorpayKeyId, razorpayTestMode, createRazorpayOrder, verifyRazorpaySignature } from './razorpay.js';

const r = createRouter();
const student = requireRole('student');
const staff = requireRole('staff');
const anyone = requireRole(null);

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw bad('Invalid id.');
  return id;
};

const session = (user) => ({ token: signJwt({ sub: user.id, role: user.role }), user: publicUser(user) });

// =====================================================================
// AUTH
// =====================================================================

r.post('/api/auth/student/signup', (req) => {
  const b = req.body;
  const email = str(b.email).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  const fields = {};
  if (!RE.email.test(email)) fields.email = 'Enter a valid email.';
  const domain = process.env.COLLEGE_EMAIL_DOMAIN;
  if (!fields.email && domain && !email.endsWith('@' + domain.toLowerCase())) {
    fields.email = `Use your @${domain} college email.`;
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fields.password = 'Use at least 8 characters with a letter and a number.';
  }
  if (!SECURITY_QUESTIONS.includes(b.security_question)) fields.security_question = 'Pick a security question.';
  else if (normAnswer(b.security_answer).length < 2) fields.security_answer = 'Answer must be at least 2 characters.';
  if (Object.keys(fields).length) throw bad('Please fix the highlighted fields.', fields);
  if (one('SELECT 1 FROM users WHERE email = ?', email)) {
    throw bad('An account with this email already exists. Try logging in.', { email: 'Already registered.' });
  }
  useOtp('signup', email, b.otp);
  const info = run(
    `INSERT INTO users (role, name, email, password_hash, security_question, security_answer_hash, email_verified, created_at)
     VALUES ('student', ?, ?, ?, ?, ?, 1, ?)`,
    nameFromEmail(email), email, hashPassword(password),
    b.security_question, hashPassword(normAnswer(b.security_answer)), Date.now()
  );
  return session(one('SELECT * FROM users WHERE id = ?', info.lastInsertRowid));
});

/** "ravi.kumar22@skcet.ac.in" -> "Ravi Kumar" (shown on receipts and the staff board). */
function nameFromEmail(email) {
  const words = email.split('@')[0].replace(/[\d_]+/g, ' ').split(/[.\-\s]+/).filter(Boolean);
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ').slice(0, 60).trim();
  return name.length >= 2 ? name : email.split('@')[0].slice(0, 60);
}

r.post('/api/auth/student/login', (req) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) throw bad('Enter your email and password.');
  const key = `${req.socket.remoteAddress}|s|${email}`;
  checkThrottle(key);
  const user = one("SELECT * FROM users WHERE role = 'student' AND email = ?", email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    noteFailure(key);
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  clearFailures(key);
  return session(user);
});

r.post('/api/auth/staff/login', (req) => {
  const staffId = str(req.body.staff_id).toUpperCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!staffId || !password) throw bad('Enter your staff ID and PIN/password.');
  const key = `${req.socket.remoteAddress}|t|${staffId}`;
  checkThrottle(key);
  const user = one("SELECT * FROM users WHERE role = 'staff' AND staff_id = ?", staffId);
  if (!user || !verifyPassword(password, user.password_hash)) {
    noteFailure(key);
    throw new HttpError(401, 'Staff ID or PIN is incorrect.');
  }
  clearFailures(key);
  return session(user);
});

r.get('/api/auth/me', anyone, (req) => ({ user: publicUser(req.user) }));

// ---------- Email one-time codes (OTP) ----------
export const SECURITY_QUESTIONS = [
  'What is your favourite canteen dish?',
  'What was the name of your first school?',
  'In which city were you born?',
  'What is your pet’s name?',
  'What is your best friend’s first name?',
];
const normAnswer = (a) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ');
const OTP_TTL = 10 * 60000;
const OTP_RESEND = 30000;
const OTP_MAX_TRIES = 5;
const otpId = (purpose, email) => crypto.createHash('sha256').update(purpose + ':' + email).digest('hex').slice(0, 32);
const maskEmail = (e) => {
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
};
const sixDigits = () => String(crypto.randomInt(100000, 1000000));

async function issueOtp(purpose, email, name) {
  const id = otpId(purpose, email);
  const prev = one('SELECT * FROM otps WHERE id = ?', id);
  if (prev && Date.now() - prev.sent_at < OTP_RESEND) {
    throw new HttpError(429, `Please wait ${Math.ceil((OTP_RESEND - (Date.now() - prev.sent_at)) / 1000)}s before asking for another code.`);
  }
  const code = sixDigits();
  const sent = await sendOtpEmail({ to: email, name, code, purpose });
  run(
    `INSERT INTO otps (id, purpose, email, code_hash, sent_at, expires, tries) VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET code_hash = excluded.code_hash, sent_at = excluded.sent_at, expires = excluded.expires, tries = 0`,
    id, purpose, email, hashPassword(code), Date.now(), Date.now() + OTP_TTL
  );
  run('DELETE FROM otps WHERE expires < ?', Date.now() - 3600000);
  return sent.demo ? { sent: true, demo: true, demo_code: code } : { sent: true, demo: false };
}

/** Check and use up a code. Throws a friendly error if wrong or expired. */
function useOtp(purpose, email, code, field = 'otp') {
  const id = otpId(purpose, email);
  const o = one('SELECT * FROM otps WHERE id = ?', id);
  const clean = String(code || '').replace(/\s+/g, '');
  if (!o || o.expires < Date.now()) throw bad('That code has expired or was never sent. Tap "Send code" to get a new one.', { [field]: 'Expired.' });
  if (o.tries >= OTP_MAX_TRIES) throw new HttpError(429, 'Too many wrong codes. Ask for a new code.');
  if (!/^\d{6}$/.test(clean) || !verifyPassword(clean, o.code_hash)) {
    run('UPDATE otps SET tries = tries + 1 WHERE id = ?', id);
    const left = OTP_MAX_TRIES - o.tries - 1;
    throw bad(`That code is not correct.${left > 0 ? ` ${left} attempt${left === 1 ? '' : 's'} left.` : ' Ask for a new code.'}`, { [field]: 'Incorrect.' });
  }
  run('DELETE FROM otps WHERE id = ?', id);
}

// ---------- Password reset helpers ----------
const LOCK_MS = 15 * 60000;
const MAX_TRIES = 5;
const studentPasswordError = (pw) =>
  typeof pw !== 'string' || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)
    ? 'Use at least 8 characters with a letter and a number.'
    : null;
function checkLock(u) {
  if (u.reset_fail_count >= MAX_TRIES && Date.now() - (u.reset_fail_first || 0) < LOCK_MS) {
    const mins = Math.ceil((LOCK_MS - (Date.now() - u.reset_fail_first)) / 60000);
    throw new HttpError(429, `Too many wrong attempts. Try again in ${mins} min, or ask the counter staff for a reset code.`);
  }
}
function noteResetFailure(u) {
  const fresh = Date.now() - (u.reset_fail_first || 0) > LOCK_MS;
  run('UPDATE users SET reset_fail_count = ?, reset_fail_first = ? WHERE id = ?',
    fresh ? 1 : (u.reset_fail_count || 0) + 1, fresh ? Date.now() : u.reset_fail_first, u.id);
}
function findStudentFor(b) {
  const email = str(b.email).toLowerCase();
  if (!email) throw bad('Enter your email.', { email: 'Enter your email.' });
  const u = one("SELECT * FROM users WHERE role = 'student' AND email = ?", email);
  if (!u) throw bad('No account uses this email. Check it, or create an account.', { email: 'No account with this email.' });
  return u;
}

r.get('/api/auth/email-mode', () => ({ real_email: emailConfigured() }));

r.post('/api/auth/otp/send', async (req) => {
  const b = req.body;
  const purpose = ['signup', 'reset', 'verify'].includes(b.purpose) ? b.purpose : null;
  if (!purpose) throw bad('Unknown request.');
  if (purpose === 'verify') {
    requireRole('student')(req);
    if (req.user.email_verified) throw bad('Your email is already verified.');
    return { ...(await issueOtp('verify', req.user.email, req.user.name)), to: maskEmail(req.user.email) };
  }
  const email = str(b.email).toLowerCase();
  if (!RE.email.test(email)) throw bad('Enter a valid college email.', { email: 'Invalid email.' });
  if (purpose === 'signup') {
    if (one('SELECT 1 FROM users WHERE email = ?', email)) throw bad('An account with this email already exists. Try logging in.', { email: 'Already registered.' });
    return { ...(await issueOtp('signup', email, str(b.name) || nameFromEmail(email))), to: maskEmail(email) };
  }
  const u = findStudentFor(b);
  checkLock(u);
  return { ...(await issueOtp('reset', u.email, u.name)), to: maskEmail(u.email) };
});

r.post('/api/auth/verify-email', student, (req) => {
  useOtp('verify', req.user.email, req.body.otp);
  run('UPDATE users SET email_verified = 1 WHERE id = ?', req.user.id);
  return { user: publicUser(one('SELECT * FROM users WHERE id = ?', req.user.id)) };
});

// Forgot password, step 1: confirm the account.
r.post('/api/auth/student/forgot', (req) => {
  const u = findStudentFor(req.body);
  checkLock(u);
  return {
    security_question: u.security_question || null,
    has_code: !!(u.reset_code_hash && u.reset_code_expires > Date.now()),
    email_hint: maskEmail(u.email),
  };
});

// Forgot password, step 2: prove it's you (email code, security answer or staff code), then set a new password.
r.post('/api/auth/student/reset', (req) => {
  const b = req.body;
  const u = findStudentFor(b);
  checkLock(u);
  const method = b.method === 'code' ? 'code' : b.method === 'email' ? 'email' : 'answer';
  let verified = false;
  if (method === 'email') {
    useOtp('reset', u.email, b.code, 'code');
    verified = true;
  } else if (method === 'answer') {
    if (!u.security_question || !u.security_answer_hash) throw bad('This account has no security question. Use an email code or ask the counter staff for a reset code.');
    verified = verifyPassword(normAnswer(b.answer), u.security_answer_hash);
  } else {
    const code = str(b.code).replace(/\s+/g, '');
    if (!u.reset_code_hash || !(u.reset_code_expires > Date.now())) {
      throw bad('There is no valid reset code for this account. Ask the counter staff for a new one.', { code: 'No active code.' });
    }
    verified = /^\d{6}$/.test(code) && verifyPassword(code, u.reset_code_hash);
  }
  if (!verified) {
    noteResetFailure(u);
    const now = one('SELECT reset_fail_count FROM users WHERE id = ?', u.id).reset_fail_count;
    const left = Math.max(0, MAX_TRIES - now);
    const what = method === 'answer' ? 'That answer is not correct.' : 'That code is not correct.';
    throw bad(`${what}${left ? ` ${left} attempt${left === 1 ? '' : 's'} left.` : ''}`, method === 'answer' ? { answer: 'Incorrect.' } : { code: 'Incorrect.' });
  }
  const err = studentPasswordError(b.new_password);
  if (err) throw bad(err, { new_password: err });
  run(
    `UPDATE users SET password_hash = ?, reset_code_hash = NULL, reset_code_expires = NULL, reset_fail_count = 0, reset_fail_first = NULL
     WHERE id = ?`,
    hashPassword(b.new_password), u.id
  );
  logActivity('settings', `${u.student_id || u.email} reset their password (${{ code: 'staff code', email: 'email code', answer: 'security question' }[method]})`);
  return { ok: true };
});

r.post('/api/auth/security-question', student, (req) => {
  const b = req.body;
  if (!verifyPassword(String(b.current_password || ''), req.user.password_hash)) {
    throw bad('Your current password is incorrect.', { current_password: 'Incorrect.' });
  }
  if (!SECURITY_QUESTIONS.includes(b.question)) throw bad('Pick a security question.', { question: 'Required.' });
  if (normAnswer(b.answer).length < 2) throw bad('Answer must be at least 2 characters.', { answer: 'Too short.' });
  run('UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?', b.question, hashPassword(normAnswer(b.answer)), req.user.id);
  return { ok: true };
});

r.post('/api/auth/change-password', anyone, (req) => {
  const b = req.body;
  const me = req.user;
  if (!verifyPassword(String(b.current_password || ''), me.password_hash)) {
    throw bad('Your current password is incorrect.', { current_password: 'Incorrect.' });
  }
  const err = me.role === 'staff'
    ? (typeof b.new_password !== 'string' || b.new_password.length < 4 || b.new_password.length > 64 ? 'PIN/password must be at least 4 characters.' : null)
    : studentPasswordError(b.new_password);
  if (err) throw bad(err, { new_password: err });
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(b.new_password), me.id);
  return { ok: true };
});

// =====================================================================
// SHARED
// =====================================================================

r.get('/api/settings/public', anyone, () => {
  const s = getSettings();
  return {
    canteen_name: s.canteen_name,
    college_name: s.college_name,
    upi_id: s.upi_id,
    accepting_orders: !!s.accepting_orders,
    now_serving: nowServing(),
  };
});

r.get('/api/menu', anyone, () => ({ items: listMenu(), categories: CATEGORIES }));

// =====================================================================
// STUDENT — ORDERS
// =====================================================================

r.post('/api/orders', student, (req) => {
  const s = getSettings();
  if (!s.accepting_orders) throw new HttpError(409, 'The canteen is not taking orders right now. Please try again shortly.');
  if (!RE.upiId.test(s.upi_id || '') && !razorpayConfigured()) throw new HttpError(409, 'Online payment is not set up yet. Please ask the counter.');

  const lines = Array.isArray(req.body.items) ? req.body.items : [];
  const note = str(req.body.note);
  if (!lines.length) throw bad('Your cart is empty.');
  if (lines.length > 30) throw bad('Too many different items in one order.');
  if (note.length > 140) throw bad('Keep the note under 140 characters.');

  const merged = new Map();
  for (const l of lines) {
    const id = Number(l?.id);
    const qty = Number(l?.qty);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) throw bad('Invalid item quantity.');
    merged.set(id, (merged.get(id) || 0) + qty);
  }

  expireStaleDrafts();

  const order = tx(() => {
    refreshDailyStock();
    const items = [];
    let total = 0;
    for (const [id, qty] of merged) {
      const row = one('SELECT * FROM menu_items WHERE id = ?', id);
      if (!row) throw bad('An item in your cart no longer exists. Please refresh the menu.');
      const it = serializeItem(row);
      if (!it.available) throw new HttpError(409, `${row.name} just sold out. Remove it to continue.`);
      if (row.stock !== null && row.stock < qty) {
        throw new HttpError(409, `Only ${row.stock} ${row.name} left today.`);
      }
      items.push({ id, name: row.name, price: row.price, qty, veg: !!row.veg });
      total += row.price * qty;
    }
    // Reserve stock
    for (const it of items) {
      const row = one('SELECT stock FROM menu_items WHERE id = ?', it.id);
      if (row.stock === null) continue;
      const left = row.stock - it.qty;
      if (left <= 0) run('UPDATE menu_items SET stock = 0, available = 0, auto_soldout = 1 WHERE id = ?', it.id);
      else run('UPDATE menu_items SET stock = ? WHERE id = ?', left, it.id);
    }
    // Tokens reset daily and increment per order
    const today = dateKey();
    const token = (one('SELECT MAX(token) AS t FROM orders WHERE order_date = ?', today).t || 0) + 1;
    const now = Date.now();
    const info = run(
      `INSERT INTO orders (token, order_date, student_id, items_json, total, note, status, payment_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'awaiting_payment', 'unpaid', ?, ?)`,
      token, today, req.user.id, JSON.stringify(items), money(total), note, now, now
    );
    return one('SELECT * FROM orders WHERE id = ?', info.lastInsertRowid);
  });
  return { order: serializeOrder(order) };
});

function ownOrder(req) {
  const o = one('SELECT * FROM orders WHERE id = ?', idParam(req));
  if (!o || o.student_id !== req.user.id) throw new HttpError(404, 'Order not found.');
  return o;
}

r.post('/api/orders/:id/paid', student, (req) => {
  const o = ownOrder(req);
  if (o.status !== 'awaiting_payment') throw new HttpError(409, 'This order is no longer waiting for payment.');
  const ref = str(req.body.upi_ref).replace(/\s+/g, '');
  if (!RE.upiRef.test(ref)) throw bad('The UPI reference ID is the 12-digit number in your payment app.', { upi_ref: 'Enter 12 digits.' });
  const dup = one("SELECT id FROM orders WHERE upi_ref = ? AND status NOT IN ('rejected','cancelled')", ref);
  if (dup) throw bad('This UPI reference ID was already used for another order.', { upi_ref: 'Already used.' });
  const screenshot = req.body.screenshot ? saveDataUrlImage(req.body.screenshot) : null;
  const now = Date.now();
  run(
    `UPDATE orders SET status = 'pending_payment', payment_status = 'pending', upi_ref = ?, screenshot = ?, paid_at = ?, updated_at = ?
     WHERE id = ?`,
    ref, screenshot, now, now, o.id
  );
  logActivity('order', `New order #${o.token} · ₹${o.total} (UPI ${ref.slice(-4)})`);
  return { order: serializeOrder(one('SELECT * FROM orders WHERE id = ?', o.id), { withQueue: true }) };
});

r.post('/api/orders/:id/cancel', student, (req) => {
  const o = ownOrder(req);
  if (o.status !== 'awaiting_payment') throw new HttpError(409, 'Paid orders can only be cancelled at the counter.');
  tx(() => {
    run("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", Date.now(), o.id);
    restoreStock(JSON.parse(o.items_json));
  });
  return { ok: true };
});

r.get('/api/orders/mine', student, (req) => {
  const rows = all(
    "SELECT * FROM orders WHERE student_id = ? AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 100",
    req.user.id
  );
  const s = getSettings();
  return { orders: rows.map((o) => serializeOrder(o, { settings: s })) };
});

r.get('/api/orders/active', student, (req) => {
  expireStaleDrafts();
  const rows = all(
    `SELECT * FROM orders WHERE student_id = ? AND order_date = ?
       AND status IN ('awaiting_payment','pending_payment','confirmed','preparing','ready')
     ORDER BY token`,
    req.user.id, dateKey()
  );
  const s = getSettings();
  return {
    orders: rows.map((o) => serializeOrder(o, { withQueue: true, settings: s })),
    now_serving: nowServing(),
    accepting_orders: !!s.accepting_orders,
  };
});

r.get('/api/orders/:id', anyone, (req) => {
  const o = one('SELECT * FROM orders WHERE id = ?', idParam(req));
  if (!o || (req.user.role === 'student' && o.student_id !== req.user.id)) throw new HttpError(404, 'Order not found.');
  return {
    order: serializeOrder(o, { withQueue: true, withStudent: true }),
    canteen: { canteen_name: getSettings().canteen_name, college_name: getSettings().college_name },
    online_pay: razorpayConfigured() ? { provider: 'razorpay', test_mode: razorpayTestMode() } : null,
    upi_ready: RE.upiId.test(getSettings().upi_id || ''),
  };
});

// ---- Razorpay (online payment, confirmed automatically) ----
r.post('/api/orders/:id/razorpay', student, async (req) => {
  if (!razorpayConfigured()) throw new HttpError(409, 'Online card/UPI checkout is not set up. Please pay by UPI.');
  const o = ownOrder(req);
  if (o.status !== 'awaiting_payment') throw new HttpError(409, 'This order is no longer waiting for payment.');
  let rzpId = o.rzp_order_id;
  if (!rzpId) {
    const created = await createRazorpayOrder({
      amountRupees: o.total,
      receipt: `qless_${o.id}`,
      notes: { qless_order: String(o.id), token: String(o.token) },
    });
    rzpId = created.id;
    run('UPDATE orders SET rzp_order_id = ?, updated_at = ? WHERE id = ?', rzpId, Date.now(), o.id);
  }
  const s = getSettings();
  return {
    key_id: razorpayKeyId(),
    rzp_order_id: rzpId,
    amount: Math.round(o.total * 100),
    currency: 'INR',
    name: s.canteen_name || 'QLess',
    description: `QLess order #${o.token}`,
    prefill: { name: req.user.name, email: req.user.email },
    test_mode: razorpayTestMode(),
  };
});

r.post('/api/orders/:id/razorpay/verify', student, (req) => {
  const o = ownOrder(req);
  const b = req.body;
  if (o.status !== 'awaiting_payment') {
    if (o.rzp_payment_id && o.rzp_payment_id === b.razorpay_payment_id) {
      return { order: serializeOrder(o, { withQueue: true }) }; // already recorded
    }
    throw new HttpError(409, 'This order is no longer waiting for payment.');
  }
  if (!o.rzp_order_id || b.razorpay_order_id !== o.rzp_order_id) throw bad('This payment does not belong to this order.');
  if (!verifyRazorpaySignature(o.rzp_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    throw bad('We could not confirm this payment. If money was taken, show the payment ID at the counter.');
  }
  const now = Date.now();
  run(
    `UPDATE orders SET status = 'confirmed', payment_status = 'verified', rzp_payment_id = ?, upi_ref = ?,
       paid_at = ?, confirmed_at = ?, updated_at = ? WHERE id = ?`,
    b.razorpay_payment_id, b.razorpay_payment_id, now, now, now, o.id
  );
  logActivity('payment', `Order #${o.token} paid online · ₹${o.total} (Razorpay${razorpayTestMode() ? ' test' : ''})`);
  return { order: serializeOrder(one('SELECT * FROM orders WHERE id = ?', o.id), { withQueue: true }) };
});

// =====================================================================
// STAFF — DASHBOARD, BOARD, QUEUE
// =====================================================================

function staffOrder(req) {
  const o = one('SELECT * FROM orders WHERE id = ?', idParam(req));
  if (!o) throw new HttpError(404, 'Order not found.');
  return o;
}

r.get('/api/staff/dashboard', staff, () => {
  const today = dateKey();
  const s = getSettings();
  const count = (sql, ...p) => one(sql, ...p).n;
  const next = nextInLine();
  return {
    accepting_orders: !!s.accepting_orders,
    canteen_name: s.canteen_name,
    upi_configured: RE.upiId.test(s.upi_id || ''),
    now_serving: nowServing(),
    next_in_line: next ? next.token : null,
    waiting: count("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND status IN ('confirmed','preparing','ready')", today),
    pending_payments: count("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND status = 'pending_payment'", today),
    served_today: count("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND status = 'collected'", today),
    earnings_today: money(
      one("SELECT COALESCE(SUM(total),0) AS t FROM orders WHERE order_date = ? AND payment_status = 'verified'", today).t
    ),
    avg_service_minutes: avgServiceMinutes(),
    activity: all('SELECT * FROM activity ORDER BY id DESC LIMIT 12').map((a) => ({ ...a })),
  };
});

r.post('/api/staff/accepting', staff, (req) => {
  const on = !!req.body.accepting;
  run('UPDATE settings SET accepting_orders = ? WHERE id = 1', on ? 1 : 0);
  logActivity('canteen', on ? `Canteen opened by ${req.user.name}` : `Orders paused by ${req.user.name}`);
  return { accepting_orders: on };
});

const TAB_STATUSES = {
  pending: ['pending_payment'],
  preparing: ['confirmed', 'preparing'],
  ready: ['ready'],
  completed: ['collected', 'rejected'],
};

r.get('/api/staff/orders', staff, () => {
  const today = dateKey();
  const rows = all(
    `SELECT * FROM orders WHERE order_date = ? AND status NOT IN ('awaiting_payment','cancelled') ORDER BY token`,
    today
  );
  const s = getSettings();
  const orders = rows.map((o) => serializeOrder(o, { withStudent: true, settings: s }));
  const tabs = {};
  for (const [tab, sts] of Object.entries(TAB_STATUSES)) {
    tabs[tab] = orders.filter((o) => sts.includes(o.status));
    if (tab === 'completed') tabs[tab].reverse();
  }
  const next = nextInLine();
  return { tabs, now_serving: nowServing(), next_in_line: next ? next.token : null };
});

r.post('/api/staff/orders/:id/confirm', staff, (req) => {
  const o = staffOrder(req);
  if (o.status !== 'pending_payment') throw new HttpError(409, `Order #${o.token} is not waiting for payment verification.`);
  const now = Date.now();
  run(
    "UPDATE orders SET status = 'confirmed', payment_status = 'verified', confirmed_at = ?, updated_at = ? WHERE id = ?",
    now, now, o.id
  );
  logActivity('payment', `Payment confirmed for #${o.token} · ₹${o.total}`);
  return { order: serializeOrder(one('SELECT * FROM orders WHERE id = ?', o.id), { withStudent: true }) };
});

r.post('/api/staff/orders/:id/reject', staff, (req) => {
  const o = staffOrder(req);
  if (o.status !== 'pending_payment') throw new HttpError(409, `Order #${o.token} can't be rejected now.`);
  const reason = str(req.body.reason);
  if (reason.length < 3 || reason.length > 140) throw bad('Give a short reason (3–140 characters).', { reason: 'Required.' });
  tx(() => {
    run(
      "UPDATE orders SET status = 'rejected', payment_status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?",
      reason, Date.now(), o.id
    );
    restoreStock(JSON.parse(o.items_json));
  });
  logActivity('reject', `Payment rejected for #${o.token}: ${reason}`);
  return { order: serializeOrder(one('SELECT * FROM orders WHERE id = ?', o.id), { withStudent: true }) };
});

const NEXT_ALLOWED = {
  confirmed: ['preparing', 'ready'],
  preparing: ['ready'],
  ready: ['collected'],
};

r.post('/api/staff/orders/:id/status', staff, (req) => {
  const o = staffOrder(req);
  const to = str(req.body.status);
  if (!(NEXT_ALLOWED[o.status] || []).includes(to)) {
    throw new HttpError(409, `Can't move #${o.token} from ${o.status} to ${to || '?'}.`);
  }
  const now = Date.now();
  const col = { preparing: 'preparing_at', ready: 'ready_at', collected: 'collected_at' }[to];
  run(`UPDATE orders SET status = ?, ${col} = ?, updated_at = ? WHERE id = ?`, to, now, now, o.id);
  const verb = { preparing: 'Preparing', ready: 'Ready', collected: 'Collected' }[to];
  logActivity(to, `#${o.token} marked ${verb}`);
  return { order: serializeOrder(one('SELECT * FROM orders WHERE id = ?', o.id), { withStudent: true }) };
});

r.post('/api/staff/queue/next', staff, () => {
  const called = callNext();
  if (!called) throw new HttpError(409, 'No one is waiting in line.');
  return { now_serving: called.token };
});

r.post('/api/staff/queue/skip', staff, () => {
  const serving = nowServing();
  if (serving == null) throw new HttpError(409, 'No token is being served right now.');
  const o = one('SELECT * FROM orders WHERE order_date = ? AND token = ?', dateKey(), serving);
  if (o && ACTIVE_STATUSES.includes(o.status)) {
    run('UPDATE orders SET skipped_at = ?, called_at = NULL, updated_at = ? WHERE id = ?', Date.now(), Date.now(), o.id);
    logActivity('skip', `Skipped token #${serving} (moved to back)`);
  }
  const called = callNext();
  if (!called) {
    run('UPDATE settings SET now_serving_token = NULL WHERE id = 1');
    return { now_serving: null };
  }
  return { now_serving: called.token };
});

// Staff check the student's college ID card, then give a one-time 6-digit code (valid 15 min).
// Staff never see or set the student's password.
r.post('/api/staff/reset-code', staff, (req) => {
  const q = str(req.body.student_id);
  const u = one("SELECT * FROM users WHERE role = 'student' AND (student_id = ? OR email = ?)", q.toUpperCase(), q.toLowerCase());
  if (!u) throw bad('No student found with that student ID or email.', { student_id: 'Not found.' });
  const code = sixDigits();
  const expires = Date.now() + 15 * 60000;
  run('UPDATE users SET reset_code_hash = ?, reset_code_expires = ?, reset_fail_count = 0, reset_fail_first = NULL WHERE id = ?', hashPassword(code), expires, u.id);
  logActivity('settings', `${req.user.name} issued a password reset code to ${u.student_id || u.email}`);
  return { ok: true, code, expires, name: u.name, student_id: u.student_id || u.email };
});

// =====================================================================
// STAFF — MENU MANAGEMENT
// =====================================================================

function parseItem(b, existing) {
  const name = str(b.name);
  const price = Number(b.price);
  const category = str(b.category);
  const description = str(b.description);
  const prep = Number(b.prep_time);
  const fields = {};
  if (name.length < 2 || name.length > 60) fields.name = 'Name should be 2–60 characters.';
  if (!Number.isFinite(price) || price <= 0 || price > 10000) fields.price = 'Enter a price between ₹1 and ₹10,000.';
  if (!CATEGORIES.includes(category)) fields.category = 'Pick a category.';
  if (description.length > 200) fields.description = 'Keep it under 200 characters.';
  if (!Number.isInteger(prep) || prep < 1 || prep > 120) fields.prep_time = 'Prep time 1–120 minutes.';
  let dailyStock = null;
  if (b.daily_stock !== null && b.daily_stock !== undefined && b.daily_stock !== '') {
    dailyStock = Number(b.daily_stock);
    if (!Number.isInteger(dailyStock) || dailyStock < 0 || dailyStock > 5000) fields.daily_stock = 'Stock must be 0–5000, or empty for unlimited.';
  }
  if (Object.keys(fields).length) throw bad('Please fix the highlighted fields.', fields);
  return {
    name, price: money(price), category, description, prep_time: prep,
    veg: b.veg === false || b.veg === 0 ? 0 : 1,
    available: b.available === false || b.available === 0 ? 0 : 1,
    daily_stock: dailyStock,
    image: existing?.image ?? null,
  };
}

r.get('/api/staff/menu', staff, () => ({ items: listMenu(), categories: CATEGORIES }));

r.post('/api/staff/menu', staff, (req) => {
  const it = parseItem(req.body);
  if (req.body.image_data) it.image = saveDataUrlImage(req.body.image_data);
  const info = run(
    `INSERT INTO menu_items (name, price, category, veg, description, image, prep_time, available, stock, daily_stock, stock_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    it.name, it.price, it.category, it.veg, it.description, it.image, it.prep_time, it.available,
    it.daily_stock, it.daily_stock, it.daily_stock === null ? null : dateKey(), Date.now()
  );
  logActivity('menu', `${req.user.name} added ${it.name}`);
  return { item: serializeItem(one('SELECT * FROM menu_items WHERE id = ?', info.lastInsertRowid)) };
});

r.put('/api/staff/menu/:id', staff, (req) => {
  const id = idParam(req);
  const row = one('SELECT * FROM menu_items WHERE id = ?', id);
  if (!row) throw new HttpError(404, 'Item not found.');
  const it = parseItem(req.body, row);
  if (req.body.image_data) {
    it.image = saveDataUrlImage(req.body.image_data);
    deleteUpload(row.image);
  } else if (req.body.remove_image) {
    deleteUpload(row.image);
    it.image = null;
  }
  // Changing the daily stock resets today's remaining stock to the new value.
  let stock = row.stock;
  let stockDate = row.stock_date;
  if (it.daily_stock !== row.daily_stock) {
    stock = it.daily_stock;
    stockDate = it.daily_stock === null ? null : dateKey();
  }
  run(
    `UPDATE menu_items SET name=?, price=?, category=?, veg=?, description=?, image=?, prep_time=?, available=?,
       stock=?, daily_stock=?, stock_date=?, auto_soldout=0 WHERE id=?`,
    it.name, it.price, it.category, it.veg, it.description, it.image, it.prep_time, it.available,
    stock, it.daily_stock, stockDate, id
  );
  return { item: serializeItem(one('SELECT * FROM menu_items WHERE id = ?', id)) };
});

r.patch('/api/staff/menu/:id/availability', staff, (req) => {
  const id = idParam(req);
  const row = one('SELECT * FROM menu_items WHERE id = ?', id);
  if (!row) throw new HttpError(404, 'Item not found.');
  const on = !!req.body.available;
  if (on && row.stock !== null && row.stock <= 0) {
    throw new HttpError(409, `${row.name} has 0 stock left today. Edit the item to add stock.`);
  }
  run('UPDATE menu_items SET available = ?, auto_soldout = 0 WHERE id = ?', on ? 1 : 0, id);
  logActivity('menu', `${row.name} marked ${on ? 'available' : 'sold out'}`);
  return { item: serializeItem(one('SELECT * FROM menu_items WHERE id = ?', id)) };
});

r.delete('/api/staff/menu/:id', staff, (req) => {
  const id = idParam(req);
  const row = one('SELECT * FROM menu_items WHERE id = ?', id);
  if (!row) throw new HttpError(404, 'Item not found.');
  run('DELETE FROM menu_items WHERE id = ?', id);
  deleteUpload(row.image);
  logActivity('menu', `${req.user.name} deleted ${row.name}`);
  return { ok: true };
});

// =====================================================================
// STAFF — PAYMENT SETTINGS
// =====================================================================

r.get('/api/staff/settings', staff, () => {
  const s = getSettings();
  return {
    canteen_name: s.canteen_name,
    college_name: s.college_name,
    upi_id: s.upi_id,
    accepting_orders: !!s.accepting_orders,
    preview_link: buildUpiLink({ upiId: s.upi_id, payeeName: s.canteen_name }),
  };
});

r.put('/api/staff/settings', staff, (req) => {
  const upi = str(req.body.upi_id);
  const canteen = str(req.body.canteen_name);
  const college = str(req.body.college_name);
  const fields = {};
  if (!RE.upiId.test(upi)) fields.upi_id = 'UPI ID should look like name@bank (e.g. canteen@okaxis).';
  if (canteen.length < 2 || canteen.length > 50) fields.canteen_name = 'Display name should be 2–50 characters.';
  if (college.length < 2 || college.length > 80) fields.college_name = 'College name should be 2–80 characters.';
  if (Object.keys(fields).length) throw bad('Please fix the highlighted fields.', fields);
  run('UPDATE settings SET upi_id = ?, canteen_name = ?, college_name = ? WHERE id = 1', upi, canteen, college);
  logActivity('settings', `${req.user.name} updated payment settings (UPI ${upi})`);
  return { ok: true, preview_link: buildUpiLink({ upiId: upi, payeeName: canteen }) };
});

// =====================================================================
// STAFF — ANALYTICS & REPORTS
// =====================================================================

const PAID = "payment_status = 'verified'";

r.get('/api/staff/analytics', staff, (req) => {
  const range = req.query.get('range') === 'today' ? 'today' : 'week';
  const days = lastNDays(7);
  const today = days[days.length - 1];
  const inRange = range === 'today' ? [today] : days;
  const ph = inRange.map(() => '?').join(',');
  const rows = all(`SELECT * FROM orders WHERE ${PAID} AND order_date IN (${ph})`, ...inRange);

  const peak = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 }));
  const items = new Map();
  for (const o of rows) {
    peak[hourOf(o.created_at)].orders++;
    for (const it of JSON.parse(o.items_json)) {
      const cur = items.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.price;
      items.set(it.name, cur);
    }
  }
  const sumFor = (keys) => {
    const p = keys.map(() => '?').join(',');
    return money(one(`SELECT COALESCE(SUM(total),0) AS t FROM orders WHERE ${PAID} AND order_date IN (${p})`, ...keys).t);
  };
  const daily = days.map((d) => {
    const x = one(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS t FROM orders WHERE ${PAID} AND order_date = ?`, d);
    return { date: d, orders: x.n, revenue: money(x.t) };
  });
  const waitRows = rows.filter((o) => o.collected_at && o.confirmed_at);
  const avgWait = waitRows.length
    ? Math.round((waitRows.reduce((s, o) => s + (o.collected_at - o.confirmed_at), 0) / waitRows.length / 60000) * 10) / 10
    : null;

  return {
    range,
    total_orders: rows.length,
    revenue_today: sumFor([today]),
    revenue_week: sumFor(days),
    orders_today: daily[daily.length - 1].orders,
    avg_service_minutes: avgServiceMinutes(),
    avg_wait_minutes: avgWait,
    peak_hours: peak,
    daily,
    best_sellers: [...items.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6)
      .map((x) => ({ ...x, revenue: money(x.revenue) })),
  };
});

r.get('/api/staff/report', staff, (req) => {
  const date = req.query.get('date') || dateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Invalid date.');
  const s = getSettings();
  const rows = all(
    `SELECT * FROM orders WHERE order_date = ? AND status NOT IN ('awaiting_payment','cancelled') ORDER BY token`,
    date
  );
  const orders = rows.map((o) => serializeOrder(o, { withStudent: true, settings: s }));
  const paid = orders.filter((o) => o.payment_status === 'verified');
  const items = new Map();
  for (const o of paid) {
    for (const it of o.items) {
      const cur = items.get(it.name) || { name: it.name, qty: 0, price: it.price, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.price;
      items.set(it.name, cur);
    }
  }
  return {
    date,
    canteen_name: s.canteen_name,
    college_name: s.college_name,
    orders,
    items_sold: [...items.values()].sort((a, b) => b.qty - a.qty).map((x) => ({ ...x, revenue: money(x.revenue) })),
    total_revenue: money(paid.reduce((t, o) => t + o.total, 0)),
    paid_orders: paid.length,
    rejected_orders: orders.filter((o) => o.status === 'rejected').length,
    generated_at: Date.now(),
  };
});

export default r;
