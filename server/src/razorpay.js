/**
 * Razorpay online payments (works in Test Mode with rzp_test_ keys).
 *
 * Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (Render › Environment). Without them
 * QLess keeps using the plain UPI link only.
 *
 * Flow: the server creates a Razorpay order for the exact bill amount, the student
 * pays in Razorpay's checkout, and the server checks Razorpay's signature
 * (HMAC-SHA256 of "order_id|payment_id" with the secret) before marking the order paid.
 */
import crypto from 'node:crypto';

const API = process.env.RAZORPAY_API || 'https://api.razorpay.com';
const keyId = () => (process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = () => (process.env.RAZORPAY_KEY_SECRET || '').trim();

export const razorpayConfigured = () => Boolean(keyId() && keySecret());
export const razorpayKeyId = () => keyId();
export const razorpayTestMode = () => keyId().startsWith('rzp_test_');

/** Create a Razorpay order. amountRupees is the bill total. */
export async function createRazorpayOrder({ amountRupees, receipt, notes }) {
  const res = await fetch(`${API}/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${keyId()}:${keySecret()}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: 'INR', receipt, notes }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Razorpay could not start the payment (${data?.error?.description || res.status}).`);
    err.status = 502;
    throw err;
  }
  return data; // { id: 'order_…', amount, currency, … }
}

/** True only if Razorpay really signed this order+payment pair. */
export function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', keySecret()).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
