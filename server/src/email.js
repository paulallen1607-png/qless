// Sends one-time codes by email through EmailJS (https://www.emailjs.com, free plan: 200 emails/month).
// Configure with server/email-config.json:
//   { "service_id": "...", "template_id": "...", "public_key": "...", "private_key": "..." }
// (or the EMAILJS_SERVICE_ID / EMAILJS_TEMPLATE_ID / EMAILJS_PUBLIC_KEY / EMAILJS_PRIVATE_KEY env vars).
// In EmailJS: Account › Security › enable "Allow EmailJS API for non-browser applications".
// Without a config, codes are not emailed: the API returns them so the screen can show them
// (labelled "email not connected"), which keeps the app usable while setting up.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './db.js';

function loadConfig() {
  const file = path.join(ROOT, 'email-config.json');
  let cfg = {};
  if (fs.existsSync(file)) {
    try {
      cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      console.error('email-config.json is not valid JSON; email sending is off.');
    }
  }
  const env = process.env;
  return {
    service_id: env.EMAILJS_SERVICE_ID || cfg.service_id,
    template_id: env.EMAILJS_TEMPLATE_ID || cfg.template_id,
    public_key: env.EMAILJS_PUBLIC_KEY || cfg.public_key,
    private_key: env.EMAILJS_PRIVATE_KEY || cfg.private_key,
  };
}
const CFG = loadConfig();

export const emailConfigured = () => !!(CFG.service_id && CFG.template_id && CFG.public_key);

const PURPOSE_TEXT = {
  signup: 'confirm your email for your new QLess account',
  reset: 'reset your QLess password',
  verify: 'verify your email on QLess',
};

export async function sendOtpEmail({ to, name, code, purpose }) {
  if (!emailConfigured()) return { demo: true };
  let res;
  try {
    res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: CFG.service_id,
        template_id: CFG.template_id,
        user_id: CFG.public_key,
        ...(CFG.private_key ? { accessToken: CFG.private_key } : {}),
        template_params: {
          to_email: to, email: to, to_name: name || 'Student', otp: code, passcode: code,
          purpose: PURPOSE_TEXT[purpose] || 'continue', app_name: 'QLess', valid_minutes: 10,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.error('EmailJS request failed:', e.message);
    const err = new Error("The email service couldn't be reached. Please try again in a minute.");
    err.status = 502;
    throw err;
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('EmailJS error', res.status, t);
    const err = new Error('The verification email could not be sent. Please try again, or ask the counter staff for help.');
    err.status = 502;
    throw err;
  }
  return { demo: false };
}
