import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { RoleBadge } from './AuthShell.jsx';
import { Button, ErrorBox, Field, Input } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { OtpBlock } from '../../components/Otp.jsx';

const pwError = (p) => (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'At least 8 characters with a letter and a number.' : null);
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Reset password with just the email and a 6-digit code sent to it. */
export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [f, setF] = useState({ code: '', new_password: '', confirm: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function next(e) {
    e.preventDefault();
    setError(null);
    if (!emailOk(email)) return setFields({ email: 'Enter the email you signed up with.' });
    setBusy(true);
    try {
      await api('/auth/student/forgot', { method: 'POST', body: { email } });
      setFields({});
      setF({ code: '', new_password: '', confirm: '' });
      setStep(2);
    } catch (x) {
      setFields(x.fields || {});
      setError(x);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e) {
    e.preventDefault();
    setError(null);
    const v = {};
    if (!/^\d{6}$/.test(f.code)) v.code = 'Enter the 6-digit code from your email.';
    const pe = pwError(f.new_password);
    if (pe) v.new_password = pe;
    if (f.confirm !== f.new_password) v.confirm = "Passwords don't match.";
    setFields(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api('/auth/student/reset', { method: 'POST', body: { email, method: 'email', code: f.code, new_password: f.new_password } });
      toast('Password changed. Log in with your new password.');
      nav('/student/login', { replace: true });
    } catch (x) {
      setFields(x.fields || {});
      setError(x);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      badge={<RoleBadge />}
      title="Reset password"
      subtitle={step === 1 ? "Enter your email. We'll send a 6-digit code to it." : 'Enter the code from your email and choose a new password.'}
      footer={
        <>
          Remembered it?{' '}
          <Link to="/student/login" className="font-semibold text-lime">
            Back to login
          </Link>
        </>
      }
    >
      {step === 1 ? (
        <form onSubmit={next} className="space-y-4" noValidate>
          <Field label="Email" error={fields.email}>
            <Input type="email" autoComplete="email" placeholder="you@skcet.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" loading={busy}>
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4" noValidate>
          <div className="text-sm text-muted">
            Account: <span className="text-ink">{email.trim().toLowerCase()}</span>
          </div>
          <OtpBlock
            autoSend
            sendBody={{ purpose: 'reset', email }}
            value={f.code}
            onChange={(code) => setF((x) => ({ ...x, code }))}
            error={fields.code}
          />
          <Field label="New password" error={fields.new_password} hint="At least 8 characters with a letter and a number.">
            <Input type="password" autoComplete="new-password" value={f.new_password} onChange={set('new_password')} error={fields.new_password} />
          </Field>
          <Field label="Confirm new password" error={fields.confirm}>
            <Input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={fields.confirm} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" loading={busy}>
            Set new password
          </Button>
          <button type="button" className="block w-full text-center text-sm text-muted" onClick={() => { setStep(1); setError(null); }}>
            Use a different email
          </button>
        </form>
      )}
    </AuthShell>
  );
}
