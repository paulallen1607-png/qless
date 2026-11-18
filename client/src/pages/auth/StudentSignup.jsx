import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { RoleBadge } from './AuthShell.jsx';
import { Button, ErrorBox, Field, Input, Select } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { SECURITY_QUESTIONS } from '../../lib/constants.js';
import { OtpBlock } from '../../components/Otp.jsx';

const DEPTS = ['Computer Science', 'Information Technology', 'Electronics & Communication', 'Electrical', 'Mechanical', 'Civil', 'Biotechnology', 'MBA', 'Other'];

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Enter a valid college email.';
  if (!/^[A-Za-z0-9-]{3,20}$/.test(f.student_id.trim())) e.student_id = '3–20 letters/numbers, e.g. 21CS045.';
  if (!f.dept) e.dept = 'Pick your department.';
  if (!f.year) e.year = 'Pick your year.';
  if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = 'At least 8 characters with a letter and a number.';
  if (f.confirm !== f.password) e.confirm = "Passwords don't match.";
  if (!f.security_question) e.security_question = 'Pick a security question.';
  if (f.security_answer.trim().length < 2) e.security_answer = 'Answer must be at least 2 characters.';
  return e;
}

export default function StudentSignup() {
  const [f, setF] = useState({ name: '', email: '', student_id: '', dept: '', year: '', password: '', confirm: '', security_question: '', security_answer: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const v = validate(f);
    setFields(v);
    if (Object.keys(v).length) return;
    if (step === 1) {
      setStep(2);
      setOtp('');
      return;
    }
    if (!/^\d{6}$/.test(otp)) return setFields({ otp: 'Enter the 6-digit code from your email.' });
    setBusy(true);
    try {
      const { confirm, ...body } = f;
      const d = await api('/auth/student/signup', { method: 'POST', body: { ...body, year: Number(body.year), otp } });
      login(d.token, d.user);
      toast('Account created. Hungry? Let’s order!');
      nav('/student', { replace: true });
    } catch (err) {
      setFields(err.fields || {});
      setError(err);
      if (err.fields && Object.keys(err.fields).some((k) => k !== 'otp')) setStep(1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      badge={<RoleBadge />}
      title="Create account"
      subtitle="Takes 30 seconds. Your details appear on your receipts."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/student/login" className="font-semibold text-lime">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {step === 2 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-stroke bg-surface p-4 text-sm">
              <div className="font-medium">Confirm your email</div>
              <p className="mt-1 text-muted">
                We'll send a 6-digit code to <b className="text-ink">{f.email.trim().toLowerCase()}</b> to make sure it's really yours.
              </p>
            </div>
            <OtpBlock
              autoSend
              sendBody={{ purpose: 'signup', email: f.email, name: f.name }}
              value={otp}
              onChange={setOtp}
              error={fields.otp}
            />
            <button type="button" className="block w-full text-center text-sm text-muted" onClick={() => { setStep(1); setError(null); }}>
              ← Edit my details
            </button>
          </div>
        ) : (
          <>
        <Field label="Full name" error={fields.name}>
          <Input autoComplete="name" placeholder="Aarav Sharma" value={f.name} onChange={set('name')} error={fields.name} />
        </Field>
        <Field label="College email" error={fields.email}>
          <Input type="email" autoComplete="email" placeholder="you@college.edu" value={f.email} onChange={set('email')} error={fields.email} />
        </Field>
        <Field label="Student ID" error={fields.student_id}>
          <Input placeholder="21CS045" value={f.student_id} onChange={set('student_id')} error={fields.student_id} className="uppercase" />
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Department" error={fields.dept}>
            <Select value={f.dept} onChange={set('dept')} error={fields.dept}>
              <option value="">Select…</option>
              {DEPTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Year" error={fields.year}>
            <Select value={f.year} onChange={set('year')} error={fields.year}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Password" error={fields.password} hint="At least 8 characters with a letter and a number.">
          <Input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={fields.password} />
        </Field>
        <Field label="Confirm password" error={fields.confirm}>
          <Input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={fields.confirm} />
        </Field>
        <div className="rounded-2xl border border-stroke bg-surface p-4">
          <div className="mb-3 text-sm font-medium">Security question</div>
          <p className="-mt-2 mb-3 text-xs text-muted">Used to verify it's you if you forget your password.</p>
          <div className="space-y-3">
            <Field label="Question" error={fields.security_question}>
              <Select value={f.security_question} onChange={set('security_question')} error={fields.security_question}>
                <option value="">Choose a question…</option>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </Select>
            </Field>
            <Field label="Your answer" error={fields.security_answer} hint="Not case-sensitive. Pick something only you know.">
              <Input value={f.security_answer} onChange={set('security_answer')} autoComplete="off" error={fields.security_answer} />
            </Field>
          </div>
        </div>
          </>
        )}
        <ErrorBox error={error} />
        <Button type="submit" className="w-full" loading={busy}>
          {step === 1 ? 'Continue: verify email' : 'Verify & create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
