import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(ROOT, 'uploads');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'qless.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL CHECK (role IN ('student','staff')),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE COLLATE NOCASE,
  staff_id      TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  student_id    TEXT UNIQUE COLLATE NOCASE,
  dept          TEXT,
  year          INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  price        REAL NOT NULL,
  category     TEXT NOT NULL,
  veg          INTEGER NOT NULL DEFAULT 1,
  description  TEXT NOT NULL DEFAULT '',
  image        TEXT,
  prep_time    INTEGER NOT NULL DEFAULT 5,
  available    INTEGER NOT NULL DEFAULT 1,
  stock        INTEGER,            -- remaining today (NULL = unlimited)
  daily_stock  INTEGER,            -- quantity the stock resets to each day
  stock_date   TEXT,
  auto_soldout INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  token          INTEGER NOT NULL,
  order_date     TEXT NOT NULL,
  student_id     INTEGER NOT NULL REFERENCES users(id),
  items_json     TEXT NOT NULL,
  total          REAL NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  upi_ref        TEXT,
  screenshot     TEXT,
  reject_reason  TEXT,
  created_at     INTEGER NOT NULL,
  paid_at        INTEGER,
  confirmed_at   INTEGER,
  preparing_at   INTEGER,
  ready_at       INTEGER,
  collected_at   INTEGER,
  called_at      INTEGER,
  skipped_at     INTEGER,
  updated_at     INTEGER NOT NULL,
  UNIQUE (order_date, token)
);
CREATE INDEX IF NOT EXISTS idx_orders_date_status ON orders(order_date, status);
CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_id, created_at);

CREATE TABLE IF NOT EXISTS settings (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  canteen_name      TEXT NOT NULL,
  college_name      TEXT NOT NULL,
  upi_id            TEXT NOT NULL,
  accepting_orders  INTEGER NOT NULL DEFAULT 1,
  now_serving_token INTEGER,
  now_serving_date  TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

// ---- Migrations: columns/tables added after the first release (safe to run every start) ----
db.exec(`
CREATE TABLE IF NOT EXISTS otps (
  id        TEXT PRIMARY KEY,
  purpose   TEXT NOT NULL,
  email     TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  sent_at   INTEGER NOT NULL,
  expires   INTEGER NOT NULL,
  tries     INTEGER NOT NULL DEFAULT 0
);
`);
{
  const have = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
  const add = [
    ['security_question', 'TEXT'],
    ['security_answer_hash', 'TEXT'],
    ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
    ['reset_code_hash', 'TEXT'],
    ['reset_code_expires', 'INTEGER'],
    ['reset_fail_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['reset_fail_first', 'INTEGER'],
  ];
  for (const [col, type] of add) if (!have.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
}
{
  const have = new Set(db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name));
  for (const col of ['rzp_order_id', 'rzp_payment_id']) if (!have.has(col)) db.exec(`ALTER TABLE orders ADD COLUMN ${col} TEXT`);
}

/** Run fn inside a write transaction. */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const one = (sql, ...p) => db.prepare(sql).get(...p);
export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

export function getSettings() {
  return one('SELECT * FROM settings WHERE id = 1');
}

export function logActivity(kind, message) {
  run('INSERT INTO activity (kind, message, created_at) VALUES (?, ?, ?)', kind, message, Date.now());
}
