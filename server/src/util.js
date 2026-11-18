export const TZ = process.env.TZ_NAME || 'Asia/Kolkata';

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

/** YYYY-MM-DD in the canteen's time zone. Tokens reset when this changes. */
export const dateKey = (ms = Date.now()) => dateFmt.format(ms);
export const hourOf = (ms) => Number(hourFmt.format(ms)) % 24;

/** The last n date keys, oldest first, ending today. */
export function lastNDays(n, now = Date.now()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateKey(now - i * 86400000));
  return out;
}

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const bad = (message, fields) => new HttpError(400, message, fields);

export const str = (v) => (typeof v === 'string' ? v.trim() : '');

export const RE = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  studentId: /^[A-Za-z0-9-]{3,20}$/,
  upiId: /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/,
  upiRef: /^\d{12}$/,
};

export const CATEGORIES = ['Meals', 'Snacks', 'Beverages', 'Breakfast', 'Desserts'];

export const ACTIVE_STATUSES = ['pending_payment', 'confirmed', 'preparing', 'ready'];

export const money = (n) => Math.round(Number(n) * 100) / 100;
