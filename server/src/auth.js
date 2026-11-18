import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, one } from './db.js';
import { HttpError } from './util.js';

// ---- Secret: env var, or generated once and stored in data/ ----
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt_secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

// ---- Password hashing (scrypt, salted) ----
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [algo, saltHex, hashHex] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---- JWT (HS256) ----
const b64u = (v) => Buffer.from(v).toString('base64url');

export function signJwt(payload, ttlSec = 60 * 60 * 24 * 14) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function publicUser(u) {
  if (!u) return null;
  const {
    password_hash, security_answer_hash, reset_code_hash, reset_code_expires, reset_fail_count, reset_fail_first, ...rest
  } = u;
  return { ...rest, email_verified: !!u.email_verified, has_security_question: !!u.security_question };
}

/** Middleware: require a valid token, optionally with a given role. */
export const requireRole = (role) => (req) => {
  const h = req.headers.authorization || '';
  const payload = verifyJwt(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!payload) throw new HttpError(401, 'Your session has expired. Please log in again.');
  const user = one('SELECT * FROM users WHERE id = ?', payload.sub);
  if (!user || user.role !== payload.role) throw new HttpError(401, 'Account not found. Please log in again.');
  if (role && user.role !== role) {
    throw new HttpError(403, role === 'staff' ? 'Staff only.' : 'Students only.');
  }
  req.user = user;
};

// ---- Simple login throttle: 8 failures per 10 min per ip+id ----
const failures = new Map();
export function checkThrottle(key) {
  const f = failures.get(key);
  if (f && f.count >= 8 && Date.now() - f.first < 10 * 60 * 1000) {
    throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.');
  }
}
export function noteFailure(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > 10 * 60 * 1000) failures.set(key, { count: 1, first: Date.now() });
  else f.count++;
}
export const clearFailures = (key) => failures.delete(key);
