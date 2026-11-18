import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// `npm run seed` wipes the database first, before db.js opens it.
if (isMain && process.argv.includes('--reset')) {
  const dbPath = process.env.DB_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/qless.db');
  for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) fs.rmSync(f, { force: true });
  console.log('Database reset.');
}

const { db, run, one, UPLOAD_DIR } = await import('./db.js');
const { hashPassword } = await import('./auth.js');
const { dateKey } = await import('./util.js');

export const DEMO = {
  student: { email: 'aarav@college.edu', password: 'student123', student_id: '21CS045' },
  staff: [
    { staff_id: 'STAFF01', password: '1234', name: 'Ravi Kumar' },
    { staff_id: 'STAFF02', password: 'kitchen99', name: 'Meena S' },
  ],
  upi_id: 'qlesscanteen@okaxis',
};

const MENU = [
  ['Veg Thali', 80, 'Meals', 1, 'Rice, 2 rotis, dal, sabzi, curd and pickle.', 12, '🍛', null],
  ['Chicken Biryani', 120, 'Meals', 0, 'Hyderabadi dum biryani with raita and salan.', 15, '🍗', null],
  ['Paneer Butter Masala + Rice', 95, 'Meals', 1, 'Creamy paneer curry with jeera rice.', 12, '🍲', null],
  ['Samosa (2 pcs)', 20, 'Snacks', 1, 'Crispy potato samosas with mint chutney.', 3, '🥟', null],
  ['Chicken Roll', 60, 'Snacks', 0, 'Spiced chicken wrapped in a flaky paratha.', 6, '🌯', null],
  ['Masala Chai', 15, 'Beverages', 1, 'Strong ginger-cardamom tea.', 2, '☕', null],
  ['Cold Coffee', 45, 'Beverages', 1, 'Thick blended coffee with ice cream.', 4, '🧋', null],
  ['Fresh Lime Soda', 30, 'Beverages', 1, 'Sweet or salted, your call.', 3, '🍋', null],
  ['Masala Dosa', 50, 'Breakfast', 1, 'Crisp dosa with potato masala, sambar and chutney.', 8, '🥞', null],
  ['Poha', 30, 'Breakfast', 1, 'Light flattened rice with peanuts and lemon.', 5, '🍚', null],
  ['Gulab Jamun (2 pcs)', 30, 'Desserts', 1, 'Warm, soft and syrupy.', 2, '🍮', null],
  ['Chocolate Brownie', 55, 'Desserts', 1, 'Fudgy brownie. Limited batch every day.', 2, '🍫', 20],
];

const GRADIENTS = {
  Meals: ['#2a2f1a', '#C6FF4D'],
  Snacks: ['#2b2214', '#FFC24D'],
  Beverages: ['#1a1f36', '#7C8CFF'],
  Breakfast: ['#1d2a22', '#79E58F'],
  Desserts: ['#2e1820', '#FF5470'],
};

function svgImage(emoji, category) {
  const [a, b] = GRADIENTS[category];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${b}" stop-opacity=".55"/><stop offset="1" stop-color="${a}"/></radialGradient></defs>
<rect width="400" height="300" fill="url(#g)"/>
<text x="200" y="185" font-size="150" text-anchor="middle">${emoji}</text></svg>`;
}

// Deterministic pseudo-random for repeatable demo history.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export function seed({ history = true } = {}) {
  if (one('SELECT COUNT(*) AS n FROM users').n > 0) return false;
  const now = Date.now();

  run(
    `INSERT INTO settings (id, canteen_name, college_name, upi_id, accepting_orders) VALUES (1, ?, ?, ?, 1)
     ON CONFLICT(id) DO NOTHING`,
    'QLess Food Court', 'Sunrise College of Engineering', DEMO.upi_id
  );

  run(
    `INSERT INTO users (role, name, email, password_hash, student_id, dept, year, security_question, security_answer_hash, email_verified, created_at)
     VALUES ('student', 'Aarav Sharma', ?, ?, ?, 'Computer Science', 3, ?, ?, 1, ?)`,
    DEMO.student.email, hashPassword(DEMO.student.password), DEMO.student.student_id,
    'What is your favourite canteen dish?', hashPassword('dosa'), now
  );
  for (const s of DEMO.staff) {
    run(
      `INSERT INTO users (role, name, staff_id, password_hash, created_at) VALUES ('staff', ?, ?, ?, ?)`,
      s.name, s.staff_id, hashPassword(s.password), now
    );
  }

  const today = dateKey();
  MENU.forEach(([name, price, category, veg, desc, prep, emoji, stock], i) => {
    const file = `seed-${i + 1}.svg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), svgImage(emoji, category));
    run(
      `INSERT INTO menu_items (name, price, category, veg, description, image, prep_time, available, stock, daily_stock, stock_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      name, price, category, veg, desc, `/uploads/${file}`, prep, stock, stock, stock === null ? null : today, now
    );
  });

  if (history) seedHistory();
  run('INSERT INTO activity (kind, message, created_at) VALUES (?, ?, ?)', 'canteen', 'QLess set up with demo data', now);
  return true;
}

/** Completed orders on the previous 6 days, so analytics and wait times have real numbers to work from. */
function seedHistory() {
  const rand = rng(42);
  const items = db.prepare('SELECT * FROM menu_items').all();
  const studentId = one("SELECT id FROM users WHERE role = 'student'").id;
  const hoursWeighted = [8, 8, 9, 9, 10, 11, 12, 12, 13, 13, 13, 14, 15, 16, 16, 17, 17, 18];
  const today = dateKey();
  const insert = db.prepare(
    `INSERT INTO orders (token, order_date, student_id, items_json, total, note, status, payment_status, upi_ref,
       created_at, paid_at, confirmed_at, preparing_at, ready_at, collected_at, called_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', 'collected', 'verified', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (let d = 6; d >= 1; d--) {
    const dayStart = Date.now() - d * 86400000;
    const key = dateKey(dayStart);
    if (key === today) continue;
    // midnight of that day in canteen TZ (approx: step back to the date's 00:00 IST)
    const base = new Date(`${key}T00:00:00+05:30`).getTime();
    const n = 8 + Math.floor(rand() * 10);
    const times = Array.from({ length: n }, () => {
      const h = hoursWeighted[Math.floor(rand() * hoursWeighted.length)];
      return base + h * 3600000 + Math.floor(rand() * 3600000);
    }).sort((a, b) => a - b);
    times.forEach((t, i) => {
      const lines = [];
      const k = 1 + Math.floor(rand() * 3);
      for (let j = 0; j < k; j++) {
        const it = items[Math.floor(rand() * items.length)];
        const ex = lines.find((l) => l.id === it.id);
        if (ex) ex.qty++;
        else lines.push({ id: it.id, name: it.name, price: it.price, qty: 1, veg: !!it.veg });
      }
      const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const paid = t + 60000;
      const confirmed = paid + 60000 + Math.floor(rand() * 60000);
      const prep = confirmed + 30000;
      const ready = prep + (3 + Math.floor(rand() * 5)) * 60000;
      const collected = ready + (1 + Math.floor(rand() * 3)) * 60000;
      const ref = String(400000000000 + Math.floor(rand() * 99999999999)).slice(0, 12);
      insert.run(i + 1, key, studentId, JSON.stringify(lines), total, ref, t, paid, confirmed, prep, ready, collected, ready, collected);
    });
  }
}

if (isMain) {
  const created = seed({ history: !process.argv.includes('--no-history') });
  console.log(created ? 'Seeded demo data.' : 'Database already has users; nothing seeded. Use `npm run seed` to reset.');
}
