// Full browser test of QLess against the real server, with separate devices sharing one database.
// Run: start a freshly seeded server, then:  node scripts/browser-test.mjs http://localhost:4000
// Needs Playwright (npx playwright install chromium) – this is a developer tool, not needed to run QLess.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
const require = createRequire(process.env.QLESS_TOOLS ? process.env.QLESS_TOOLS + '/' : import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4000';
const OUT = process.env.SHOTS || '/tmp/qless-full';
fs.mkdirSync(OUT, { recursive: true });
const T = 20000;
const errors = [];
let n = 0;
const ok = (m) => console.log('  ✓', m, ++n && '');
const step = (m) => console.log('•', m);

const browser = await chromium.launch();
async function device(name, mobile = true) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 400, height: 860 } : { width: 1280, height: 860 },
    acceptDownloads: true,
    userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' : undefined,
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|ERR_NAME|net::ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  await p.goto(BASE);
  return p;
}
const shot = (p, f) => p.screenshot({ path: `${OUT}/${f}.png` });
async function download(p, click, name) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: T }), click()]);
  const file = `${OUT}/${name}`;
  await dl.saveAs(file);
  const head = fs.readFileSync(file).subarray(0, 5).toString();
  if (head !== '%PDF-') throw new Error(name + ' is not a PDF');
  return fs.statSync(file).size;
}
async function logout(p) {
  await p.getByRole('link', { name: /Profile/ }).click();
  await p.getByRole('button', { name: /Log out/ }).first().click();
  await p.getByRole('button', { name: 'Log out' }).last().click();
  await p.getByText("I'm a Student").waitFor({ timeout: T });
}
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAASElEQVR4nO3OMQEAAAjDMMC/56EBvlRA03aSqgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4bQ8UAAGhD7HJAAAAAElFTkSuQmCC', 'base64');
fs.writeFileSync(`${OUT}/photo.png`, png1x1);

try {
  // ------------------------------------------------------------------
  step('Student phone: sign up with email code');
  const A = await device('student-phone');
  await A.getByText("I'm a Student").click();
  await A.getByText('Create an account').click();
  await A.getByPlaceholder('Aarav Sharma').fill('Paul Allen');
  await A.getByPlaceholder('you@college.edu').fill('Paul@College.edu');
  await A.getByPlaceholder('21CS045').fill('23cs001');
  await A.locator('select').nth(0).selectOption('Computer Science');
  await A.locator('select').nth(1).selectOption('2');
  await A.getByLabel('Password', { exact: true }).fill('paul12345');
  await A.getByLabel('Confirm password').fill('paul12345');
  await A.locator('select').nth(2).selectOption('In which city were you born?');
  await A.getByLabel('Your answer').fill('Coimbatore');
  await A.getByRole('button', { name: /Continue: verify email/ }).click();
  await A.getByLabel('Demo code').waitFor({ timeout: T });
  await A.getByPlaceholder('••••••').fill((await A.getByLabel('Demo code').innerText()).trim());
  await A.getByRole('button', { name: /Verify & create account/ }).click();
  await A.getByRole('button', { name: /Order Food/ }).waitFor({ timeout: T });
  ok('signed up on the student phone');

  step('THE BUG: same account on a different phone');
  const C = await device('second-phone');
  await C.getByText("I'm a Student").click();
  await C.getByPlaceholder('you@college.edu').fill('paul@college.edu');
  await C.getByPlaceholder('••••••••').fill('paul12345');
  await C.getByRole('button', { name: 'Log in' }).click();
  await C.getByRole('button', { name: /Order Food/ }).waitFor({ timeout: T });
  ok('correct password works on another device (shared database)');
  await C.reload();
  await C.getByRole('button', { name: /Order Food/ }).waitFor({ timeout: T });
  ok('stays logged in after refresh');

  // ------------------------------------------------------------------
  step('Staff laptop: log in');
  const B = await device('staff-laptop', false);
  await B.getByText("I'm Staff").click();
  await B.getByPlaceholder('STAFF01').fill('staff01');
  await B.getByPlaceholder('••••').fill('1234');
  await B.getByRole('button', { name: 'Log in to counter' }).click();
  await B.getByText('Currently serving').waitFor({ timeout: T });
  ok('staff logged in on the laptop');

  step('Staff adds a new item with a photo; student sees it');
  await B.getByRole('link', { name: /Menu/ }).click();
  await B.getByRole('button', { name: /Add item/ }).first().click();
  await B.locator('input[type=file]').setInputFiles(`${OUT}/photo.png`);
  await B.getByPlaceholder('e.g. Vada Pav').fill('Vada Pav');
  await B.getByPlaceholder('40').fill('25');
  await B.getByRole('button', { name: 'Snacks' }).last().click();
  await B.getByPlaceholder('Unlimited').fill('2');
  await B.getByRole('button', { name: 'Add item' }).last().click();
  await B.getByText('Vada Pav added to the menu').waitFor({ timeout: T });
  ok('item with photo + daily stock 2 added');
  await A.getByRole('button', { name: /Order Food/ }).click();
  await A.locator('article').filter({ hasText: 'Vada Pav' }).waitFor({ timeout: T });
  const imgSrc = await A.locator('article').filter({ hasText: 'Vada Pav' }).locator('img').getAttribute('src');
  if (!imgSrc.startsWith('/uploads/')) throw new Error('photo not served: ' + imgSrc);
  ok('student phone sees Vada Pav with its uploaded photo');

  step('Student orders and pays by UPI');
  const card = (name) => A.locator('article').filter({ hasText: name });
  await card('Masala Chai').getByRole('button', { name: /Add/ }).click();
  await card('Masala Chai').getByRole('button', { name: 'Add one' }).click();
  await card('Vada Pav').getByRole('button', { name: /Add/ }).click();
  await A.getByRole('button', { name: /View cart/ }).click();
  await A.getByPlaceholder('e.g. less spicy, no onion').fill('less sugar');
  await A.getByRole('button', { name: /Proceed to pay ₹55/ }).click();
  const link = A.locator('a', { hasText: 'Pay with UPI' });
  await link.waitFor({ timeout: T });
  const href = await link.getAttribute('href');
  if (!href.startsWith('upi://pay?pa=qlesscanteen@okaxis&pn=QLess%20Food%20Court&am=55.00&cu=INR&tn=QLess%20Order%201')) throw new Error('bad UPI link ' + href);
  if ((await link.getAttribute('target')) !== null) throw new Error('UPI link must open the app directly');
  ok('UPI link correct (₹55, token #1) and opens the UPI app directly');
  await A.getByRole('button', { name: /Copy UPI ID/ }).click();
  await A.getByText(/UPI ID copied|UPI ID: /).first().waitFor({ timeout: T });
  ok('Copy UPI ID works');
  await A.getByRole('button', { name: /I've paid/ }).click();
  await A.getByPlaceholder('e.g. 412345678901').fill('4123 4567 8901');
  await A.locator('input[type=file]').setInputFiles(`${OUT}/photo.png`);
  await A.getByRole('button', { name: 'Submit for verification' }).click();
  await A.getByRole('heading', { name: 'Order #1' }).waitFor({ timeout: T });
  ok('payment submitted with screenshot; tracking page shows token #1');

  step('Staff confirms on the laptop; student gets live updates');
  await B.getByRole('link', { name: /Orders/ }).click();
  await B.getByText('Paul Allen').waitFor({ timeout: T });
  await B.getByRole('button', { name: 'Screenshot' }).click();
  await B.locator('img[alt="Payment screenshot"]').waitFor({ timeout: T });
  await B.keyboard.press('Escape');
  ok('staff sees the order, UPI ref and payment screenshot');
  await B.getByRole('button', { name: /Confirm payment/ }).click();
  await A.getByText('Confirmed', { exact: true }).first().waitFor({ timeout: T });
  ok('student phone shows Confirmed (live)');
  await B.locator('button', { hasText: /^Preparing/ }).first().click();
  await B.getByRole('button', { name: /Mark Preparing/ }).click();
  await B.getByRole('button', { name: /Mark Ready/ }).click();
  await A.getByText('Your order is ready!').first().waitFor({ timeout: T });
  await shot(A, 'ready-alert');
  ok('student phone pops up "Your order is ready!"');
  await A.getByRole('button', { name: 'View order' }).click();

  step('Call Next, kitchen ticket PDF, collect');
  await B.getByRole('button', { name: /Call Next/ }).click();
  await B.getByText(/Now serving #1/).first().waitFor({ timeout: T });
  await A.getByText('Your token is being called', { exact: false }).first().waitFor({ timeout: T });
  ok('student sees "your token is being called"');
  await B.locator('button', { hasText: /^Ready/ }).first().click();
  await B.getByRole('link', { name: /Ticket/ }).click();
  const tk = await download(B, () => B.getByRole('button', { name: /Download PDF/ }).click(), 'ticket.pdf');
  ok(`kitchen ticket PDF downloaded (${tk} bytes)`);
  await B.locator('button[aria-label=Back]').click();
  await B.getByRole('button', { name: /Mark Collected/ }).click({ timeout: T });
  await A.getByText('Collected').first().waitFor({ timeout: T });
  ok('marked collected; student sees it');

  step('Receipt PDF on the phone');
  await A.locator('[aria-label=Receipt]').click();
  await A.getByText('Order token', { exact: true }).waitFor({ timeout: T });
  const rc = await download(A, () => A.getByRole('button', { name: /Download PDF/ }).click(), 'receipt.pdf');
  ok(`receipt PDF downloaded (${rc} bytes)`);
  await A.locator('button[aria-label=Back]').click();

  step('Stock limit: Vada Pav (2 per day) after ordering 1 → 1 left; order the last one → sold out everywhere');
  await A.getByRole('link', { name: /Menu/ }).click();
  await card('Vada Pav').getByText('Only 1 left').waitFor({ timeout: T });
  await card('Vada Pav').getByRole('button', { name: /Add/ }).click();
  await A.getByRole('button', { name: /View cart/ }).click();
  await A.getByRole('button', { name: /Proceed to pay/ }).click();
  await A.getByText('Pay with UPI').first().waitFor({ timeout: T });
  // The second phone is the same student, so it also got the "ready" pop-up: close it like a user would.
  if (await C.getByRole('button', { name: 'View order' }).isVisible()) await C.keyboard.press('Escape');
  await C.getByRole('button', { name: /Order Food/ }).click();
  await C.locator('article').filter({ hasText: 'Vada Pav' }).getByText('Unavailable').waitFor({ timeout: T });
  ok('other phone sees Vada Pav as Unavailable');
  await A.getByRole('button', { name: /Cancel this order/ }).click();
  await A.getByRole('button', { name: 'Cancel order' }).click();
  await A.getByText('Order cancelled.').waitFor({ timeout: T });
  await C.locator('article').filter({ hasText: 'Vada Pav' }).getByText('Only 1 left').waitFor({ timeout: T });
  ok('cancelling gives the stock back');

  step('Staff marks an item sold out; pauses ordering');
  await B.getByRole('link', { name: /Menu/ }).click();
  await B.getByRole('switch', { name: 'Samosa (2 pcs) available' }).click();
  await C.locator('article').filter({ hasText: 'Samosa' }).getByText('Unavailable').waitFor({ timeout: T });
  ok('sold-out switch shows on the phone');
  await B.getByRole('link', { name: /Dashboard/ }).click();
  await B.getByRole('switch', { name: 'Accept orders' }).click();
  await C.getByText('Ordering is paused right now', { exact: false }).waitFor({ timeout: T });
  ok('pause shows on the phone; ordering blocked');
  await B.getByRole('switch', { name: 'Accept orders' }).click();
  await C.getByText('Ordering is paused right now', { exact: false }).waitFor({ state: 'detached', timeout: T });
  ok('resume works');

  step('Staff changes the UPI ID; new orders use it');
  await B.getByRole('link', { name: /Profile/ }).click();
  await B.getByRole('link', { name: /Payment settings/ }).click();
  await B.locator('input.font-mono').fill('bad');
  await B.getByText('Format: name@bank').waitFor();
  await B.locator('input.font-mono').fill('mycanteen@ybl');
  await B.getByRole('button', { name: 'Save settings' }).click();
  await B.getByRole('button', { name: 'Saved' }).waitFor({ timeout: T });
  await C.locator('article').filter({ hasText: 'Masala Dosa' }).getByRole('button', { name: /Add/ }).click();
  await C.getByRole('button', { name: /View cart/ }).click();
  await C.getByRole('button', { name: /Proceed to pay/ }).click();
  await C.locator('a', { hasText: 'Pay with UPI' }).waitFor({ timeout: T });
  if (!(await C.locator('a', { hasText: 'Pay with UPI' }).getAttribute('href')).includes('pa=mycanteen@ybl')) throw new Error('UPI id not updated');
  ok('new order pays to mycanteen@ybl');
  await C.getByRole('button', { name: /Cancel this order/ }).click();
  await C.getByRole('button', { name: 'Cancel order' }).click();

  step('Analytics + daily report PDF');
  await B.locator('button[aria-label=Back]').first().click();
  await B.locator('nav').getByRole('link', { name: /Analytics/ }).click();
  await B.getByText('Peak hours').waitFor({ timeout: T });
  await B.getByText('Best-selling items').waitFor();
  await shot(B, 'analytics');
  ok('analytics page renders');
  await B.getByRole('link', { name: /Profile/ }).click();
  await B.getByRole('link', { name: /Daily sales report/ }).click();
  await B.getByText('Items sold', { exact: false }).first().waitFor({ timeout: T });
  const rp = await download(B, () => B.getByRole('button', { name: /Download PDF/ }).click(), 'report.pdf');
  ok(`daily report PDF downloaded (${rp} bytes)`);
  await B.locator('button[aria-label=Back]').first().click();

  step('Forgot password on a fresh phone (email code)');
  const D = await device('fresh-phone');
  await D.getByText("I'm a Student").click();
  await D.getByText('Forgot password?').click();
  await D.getByPlaceholder('you@college.edu').fill('paul@college.edu');
  await D.getByPlaceholder('21CS045').fill('23CS001');
  await D.getByRole('button', { name: 'Continue' }).click();
  await D.getByRole('button', { name: /Send code to my email/ }).click();
  await D.getByLabel('Demo code').waitFor({ timeout: T });
  await D.getByPlaceholder('••••••').fill((await D.getByLabel('Demo code').innerText()).trim());
  await D.getByLabel('New password', { exact: true }).fill('paulnew99');
  await D.getByLabel('Confirm new password').fill('paulnew99');
  await D.getByRole('button', { name: /Verify/ }).click();
  await D.getByRole('heading', { name: 'Student login' }).waitFor({ timeout: T });
  await D.getByPlaceholder('you@college.edu').fill('paul@college.edu');
  await D.getByPlaceholder('••••••••').fill('paulnew99');
  await D.getByRole('button', { name: 'Log in' }).click();
  await D.getByRole('button', { name: /Order Food/ }).waitFor({ timeout: T });
  ok('password reset by email code; new password works on any device');

  step('Server restart: nothing is lost');
  if (process.env.RESTART_CMD) {
    await A.locator('nav').getByRole('link', { name: /Home/ }).click();
    await A.getByRole('button', { name: /Order Food/ }).waitFor({ timeout: T });
    execSync(process.env.STOP_CMD);
    await A.getByText("Can't reach the QLess server", { exact: false }).first().waitFor({ timeout: T });
    await shot(A, 'server-down');
    ok('server stopped: the open app shows a clear message and keeps working (no crash)');
    spawn('sh', ['-c', process.env.RESTART_CMD], { detached: true, stdio: 'ignore' }).unref();
    await A.getByText("Can't reach the QLess server", { exact: false }).first().waitFor({ state: 'detached', timeout: T });
    ok('server back: the app reconnects by itself');
    await A.reload();
    await A.getByRole('link', { name: /Orders/ }).click({ timeout: T });
    await A.getByText('#1').first().waitFor({ timeout: T });
    ok('after restart: still logged in and order #1 is still there');
  }

  console.log(`\nPASS: ${n} checks. Page errors:`, errors.length ? errors : 'none');
} catch (e) {
  console.log('\nFAILED:', e.message.split('\n')[0]);
  for (const [i, c] of browser.contexts().entries()) for (const p of c.pages()) await p.screenshot({ path: `${OUT}/fail-${i}.png` }).catch(() => {});
  console.log('Page errors:', errors);
  process.exitCode = 1;
}
await browser.close();
