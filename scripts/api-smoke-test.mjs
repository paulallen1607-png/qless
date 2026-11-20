// End-to-end API smoke test. Usage: node scripts/api-smoke-test.mjs [baseUrl]
// Run against a freshly seeded server (cd server && npm run seed && npm start).
const BASE = process.argv[2] || 'http://localhost:4000';
let pass = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  pass++;
  console.log('  ✓', msg);
};
async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const st = await call('/auth/student/login', { method: 'POST', body: { email: 'aarav@college.edu', password: 'student123' } });
ok(st.status === 200 && st.data.user.role === 'student', 'student login');
const S = st.data.token;
const sf = await call('/auth/staff/login', { method: 'POST', body: { staff_id: 'staff01', password: '1234' } });
ok(sf.status === 200 && sf.data.user.role === 'staff', 'staff login (case-insensitive ID)');
const T = sf.data.token;

ok((await call('/auth/staff/login', { method: 'POST', body: { staff_id: 'STAFF01', password: 'x' } })).status === 401, 'wrong PIN rejected');
ok((await call('/staff/dashboard', { token: S })).status === 403, 'student blocked from staff API');
ok((await call('/orders/mine', { token: T })).status === 403, 'staff blocked from student API');
ok((await call('/menu')).status === 401, 'menu needs login');

const su = await call('/auth/student/signup', {
  method: 'POST',
  body: { name: 'Test', email: 'bad', student_id: '!', dept: '', year: 9, password: 'short' },
});
ok(su.status === 400 && Object.keys(su.data.fields).length === 3, 'signup validation: email, password, security question');
const priyaEmail = `priya${Date.now()}@college.edu`;
const priyaBody = { name: 'Priya Nair', email: priyaEmail, student_id: 'EC' + (Date.now() % 100000), dept: 'ECE', year: 2, password: 'priya1234',
  security_question: 'In which city were you born?', security_answer: 'Coimbatore' };
ok((await call('/auth/student/signup', { method: 'POST', body: { ...priyaBody, otp: '123456' } })).status === 400, 'signup without a sent code is refused');
const otp1 = await call('/auth/otp/send', { method: 'POST', body: { purpose: 'signup', email: priyaEmail, name: 'Priya' } });
ok(otp1.status === 200 && /^\d{6}$/.test(otp1.data.demo_code), 'signup code issued (shown because email is not configured)');
ok((await call('/auth/otp/send', { method: 'POST', body: { purpose: 'signup', email: priyaEmail } })).status === 429, 'resend blocked for 30s');
const wrong = otp1.data.demo_code === '111111' ? '222222' : '111111';
ok((await call('/auth/student/signup', { method: 'POST', body: { ...priyaBody, otp: wrong } })).data.error.includes('not correct'), 'wrong code refused');
const su2 = await call('/auth/student/signup', { method: 'POST', body: { ...priyaBody, otp: otp1.data.demo_code } });
ok(su2.status === 200 && su2.data.token && su2.data.user.email_verified === true && !('password_hash' in su2.data.user), 'signup works; email verified; no hash leaked');
ok((await call('/auth/student/signup', { method: 'POST', body: { ...priyaBody, otp: otp1.data.demo_code } })).status === 400, 'code cannot be reused');
const relog = await call('/auth/student/login', { method: 'POST', body: { email: priyaEmail.toUpperCase(), password: 'priya1234' } });
ok(relog.status === 200, 'new account can log in again (email not case-sensitive)');

const menu = await call('/menu', { token: S });
ok(menu.data.items.length === 12, '12 seeded menu items');
const brownie = menu.data.items.find((i) => i.name === 'Chocolate Brownie');
const chai = menu.data.items.find((i) => i.name === 'Masala Chai');
ok(brownie.stock === 20, 'brownie has daily stock 20');

// Pause blocks ordering
await call('/staff/accepting', { method: 'POST', token: T, body: { accepting: false } });
ok((await call('/orders', { method: 'POST', token: S, body: { items: [{ id: chai.id, qty: 1 }] } })).status === 409, 'paused canteen blocks orders');
await call('/staff/accepting', { method: 'POST', token: T, body: { accepting: true } });

const o1 = await call('/orders', { method: 'POST', token: S, body: { items: [{ id: chai.id, qty: 2 }, { id: brownie.id, qty: 1 }], note: 'less sugar' } });
ok(o1.status === 200 && o1.data.order.token === 1, 'order created with token 1 (daily reset)');
ok(o1.data.order.total === 85, 'total computed server-side (2×15 + 55)');
ok(o1.data.order.upi.link === 'upi://pay?pa=9344645714@ybl&pn=QLess%20Food%20Court&am=85.00&cu=INR&tn=QLess%20Order%201', 'UPI link uses saved UPI id');
const id1 = o1.data.order.id;
ok((await call('/menu', { token: S })).data.items.find((i) => i.id === brownie.id).stock === 19, 'stock reserved');

ok((await call(`/orders/${id1}/paid`, { method: 'POST', token: S, body: { upi_ref: '1234' } })).status === 400, 'bad UPI ref rejected');
const p1 = await call(`/orders/${id1}/paid`, { method: 'POST', token: S, body: { upi_ref: '412345678901' } });
ok(p1.data.order.status === 'pending_payment', 'status: payment pending verification');

const o2 = await call('/orders', { method: 'POST', token: su2.data.token, body: { items: [{ id: chai.id, qty: 1 }] } });
ok(o2.data.order.token === 2, 'second order gets token 2');
ok((await call(`/orders/${o2.data.order.id}/paid`, { method: 'POST', token: su2.data.token, body: { upi_ref: '412345678901' } })).status === 400, 'duplicate UPI ref rejected');
await call(`/orders/${o2.data.order.id}/paid`, { method: 'POST', token: su2.data.token, body: { upi_ref: '599999999999' } });
ok((await call(`/orders/${id1}`, { token: su2.data.token })).status === 404, "students can't see others' orders");

const board = await call('/staff/orders', { token: T });
ok(board.data.tabs.pending.length === 2 && board.data.tabs.pending[0].student.student_id === '21CS045', 'staff board shows pending with student');

const rej = await call(`/staff/orders/${o2.data.order.id}/reject`, { method: 'POST', token: T, body: { reason: 'No payment received' } });
ok(rej.data.order.status === 'rejected', 'reject payment with reason');
ok((await call(`/staff/orders/${id1}/confirm`, { method: 'POST', token: T })).data.order.status === 'confirmed', 'confirm payment');

let tr = await call(`/orders/${id1}`, { token: S });
ok(tr.data.order.queue.people_ahead === 0 && tr.data.order.queue.eta_minutes > 0, 'queue info: 0 ahead, eta > 0');

ok((await call(`/staff/orders/${id1}/status`, { method: 'POST', token: T, body: { status: 'collected' } })).status === 409, 'invalid transition blocked');
await call(`/staff/orders/${id1}/status`, { method: 'POST', token: T, body: { status: 'preparing' } });
await call(`/staff/orders/${id1}/status`, { method: 'POST', token: T, body: { status: 'ready' } });
const nx = await call('/staff/queue/next', { method: 'POST', token: T });
ok(nx.data.now_serving === 1, 'call next → now serving #1');
const act = await call('/orders/active', { token: S });
ok(act.data.orders[0].status === 'ready' && act.data.now_serving === 1, 'student sees ready + now serving');
await call(`/staff/orders/${id1}/status`, { method: 'POST', token: T, body: { status: 'collected' } });

const dash = await call('/staff/dashboard', { token: T });
ok(dash.data.served_today === 1 && dash.data.earnings_today === 85, 'dashboard served/earnings');

// Settings validation
ok((await call('/staff/settings', { method: 'PUT', token: T, body: { upi_id: 'nope', canteen_name: 'X Y', college_name: 'Z College' } })).status === 400, 'invalid UPI id rejected');
ok((await call('/staff/settings', { method: 'PUT', token: T, body: { upi_id: 'newcanteen@ybl', canteen_name: 'QLess Food Court', college_name: 'Sunrise College of Engineering' } })).status === 200, 'UPI id saved');
const o3 = await call('/orders', { method: 'POST', token: S, body: { items: [{ id: chai.id, qty: 1 }] } });
ok(o3.data.order.upi.link.includes('pa=newcanteen@ybl'), 'new orders pay to the updated UPI id');
ok((await call(`/orders/${o3.data.order.id}/cancel`, { method: 'POST', token: S })).status === 200, 'cancel unpaid order');
await call('/staff/settings', { method: 'PUT', token: T, body: { upi_id: '9344645714@ybl', canteen_name: 'QLess Food Court', college_name: 'Sunrise College of Engineering' } });

// Menu management
const add = await call('/staff/menu', { method: 'POST', token: T, body: { name: 'Vada Pav', price: 25, category: 'Snacks', veg: true, prep_time: 3, daily_stock: 1, description: 'Mumbai style' } });
ok(add.status === 200 && add.data.item.stock === 1, 'add item with stock');
const o4 = await call('/orders', { method: 'POST', token: S, body: { items: [{ id: add.data.item.id, qty: 1 }] } });
ok(o4.status === 200, 'order last unit');
ok((await call('/menu', { token: S })).data.items.find((i) => i.id === add.data.item.id).available === false, 'auto sold out at 0 stock');
await call(`/orders/${o4.data.order.id}/cancel`, { method: 'POST', token: S });
ok((await call('/menu', { token: S })).data.items.find((i) => i.id === add.data.item.id).available === true, 'cancel restores stock + availability');
ok((await call(`/staff/menu/${add.data.item.id}/availability`, { method: 'PATCH', token: T, body: { available: false } })).data.item.available === false, 'toggle sold out');
ok((await call(`/staff/menu/${add.data.item.id}`, { method: 'DELETE', token: T })).status === 200, 'delete item');

const an = await call('/staff/analytics?range=week', { token: T });
ok(an.data.total_orders > 10 && an.data.best_sellers.length > 0 && an.data.peak_hours.length === 24, 'analytics');
const rep = await call('/staff/report', { token: T });
ok(rep.data.total_revenue === 85 && rep.data.rejected_orders === 1, 'daily report');


// ---- password reset & account security ----
const fp = await call('/auth/student/forgot', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21cs045' } });
ok(fp.data.security_question === 'What is your favourite canteen dish?', 'forgot: shows the security question');
ok((await call('/auth/student/forgot', { method: 'POST', body: { email: 'nobody@college.edu' } })).status === 400, 'forgot: unknown email refused');
const badAns = await call('/auth/student/reset', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21CS045', method: 'answer', answer: 'pizza', new_password: 'hacked123' } });
ok(badAns.status === 400 && badAns.data.error.includes('4 attempts left'), 'reset: wrong answer refused');
ok((await call('/auth/student/login', { method: 'POST', body: { email: 'aarav@college.edu', password: 'student123' } })).status === 200, 'password unchanged after wrong answer');
ok((await call('/auth/student/reset', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21CS045', method: 'answer', answer: ' Dosa ', new_password: 'newpass456' } })).status === 200, 'reset with right answer');
ok((await call('/auth/student/login', { method: 'POST', body: { email: 'aarav@college.edu', password: 'newpass456' } })).status === 200, 'new password works');
const ro = await call('/auth/otp/send', { method: 'POST', body: { purpose: 'reset', email: 'aarav@college.edu', student_id: '21CS045' } });
ok((await call('/auth/student/reset', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21CS045', method: 'email', code: ro.data.demo_code, new_password: 'emailpass1' } })).status === 200, 'reset with email code');
const rc = await call('/staff/reset-code', { method: 'POST', token: T, body: { student_id: '21cs045' } });
ok(/^\d{6}$/.test(rc.data.code), 'staff issues a one-time reset code');
ok((await call('/staff/reset-code', { method: 'POST', token: S, body: { student_id: '21cs045' } })).status === 403, 'students cannot issue reset codes');
ok((await call('/auth/student/reset', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21CS045', method: 'code', code: rc.data.code, new_password: 'student123' } })).status === 200, 'reset with staff code (back to student123)');
ok((await call('/auth/student/reset', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21CS045', method: 'code', code: rc.data.code, new_password: 'again1234' } })).status === 400, 'staff code works only once');
for (let i = 0; i < 5; i++) await call('/auth/student/reset', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21CS045', method: 'answer', answer: 'x' + i, new_password: 'hacked123' } });
ok((await call('/auth/student/reset', { method: 'POST', body: { email: 'aarav@college.edu', student_id: '21CS045', method: 'answer', answer: 'dosa', new_password: 'hacked123' } })).status === 429, 'locked after 5 wrong attempts');
const S2 = (await call('/auth/student/login', { method: 'POST', body: { email: 'aarav@college.edu', password: 'student123' } })).data.token;
ok(!!S2, 'still logs in with the real password during the lockout');
ok((await call('/auth/change-password', { method: 'POST', token: S2, body: { current_password: 'nope', new_password: 'x1234567' } })).status === 400, 'change password needs current password');
ok((await call('/auth/change-password', { method: 'POST', token: S2, body: { current_password: 'student123', new_password: 'student123' } })).status === 200, 'change password works');
ok((await call('/auth/security-question', { method: 'POST', token: S2, body: { current_password: 'student123', question: 'In which city were you born?', answer: 'Chennai' } })).status === 200, 'security question updated');
ok((await call('/auth/change-password', { method: 'POST', token: T, body: { current_password: '1234', new_password: '1234' } })).status === 200, 'staff can change PIN');
const me = await call('/auth/me', { token: S2 });
ok(me.data.user.has_security_question && !('security_answer_hash' in me.data.user) && !('reset_code_hash' in me.data.user), 'profile hides secrets');

console.log(`\nAll ${pass} checks passed.`);
