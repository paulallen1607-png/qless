import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { RoleBadge } from './AuthShell.jsx';
import { Button, Chip, ErrorBox, Field, Input } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { OtpBlock } from '../../components/Otp.jsx';

const pwError = (p) => (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'At least 8 characters with a letter and a number.' : null);

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [who, setWho] = useState({ email: '', student_id: '' });
  const [info, setInfo] = useState(null); // { security_question, has_code }
  const [method, setMethod] = useState('answer');
  const [f, setF] = useState({ answer: '', code: '', new_password: '', confirm: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function findAccount(e) {
    e.preventDefault();
    setError(null);
    const v = {};
    if (!who.email.trim()) v.email = 'Enter your college email.';
    if (!who.student_id.trim()) v.student_id = 'Enter your student ID.';
    setFields(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const d = await api('/auth/student/forgot', { method: 'POST', body: who });
      setInfo(d);
      setMethod(d.has_code ? 'code' : 'email');
      setStep(2);
      setFields({});
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
    if (method === 'answer' && !f.answer.trim()) v.answer = 'Enter your answer.';
    if (method === 'code' && !/^\d{6}$/.test(f.code.replace(/\s+/g, ''))) v.code = 'Enter the 6-digit code from the counter.';
    if (method === 'email' && !/^\d{6}$/.test(f.code)) v.code = 'Send the code, then enter the 6 digits from your email.';
    const pe = pwError(f.new_password);
    if (pe) v.new_password = pe;
    if (f.confirm !== f.new_password) v.confirm = "Passwords don't match.";
    setFields(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api('/auth/student/reset', {
        method: 'POST',
        body: { ...who, method, answer: f.answer, code: f.code, new_password: f.new_password },
      });
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
      subtitle={step === 1 ? 'First, tell us which account it is.' : "Now prove it's you, then choose a new password."}
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
        <form onSubmit={findAccount} className="space-y-4" noValidate>
          <Field label="College email" error={fields.email}>
            <Input type="email" autoComplete="email" placeholder="you@college.edu" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} error={fields.email} />
          </Field>
          <Field label="Student ID" error={fields.student_id}>
            <Input placeholder="21CS045" className="uppercase" value={who.student_id} onChange={(e) => setWho({ ...who, student_id: e.target.value })} error={fields.student_id} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" loading={busy}>
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4" noValidate>
          <div className="text-sm text-muted">
            Account: <span className="text-ink">{who.email}</span> · {who.student_id.toUpperCase()}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={method === 'email'} onClick={() => { setMethod('email'); setF({ ...f, code: '' }); }}>
              Email code
            </Chip>
            {info.security_question && (
              <Chip active={method === 'answer'} onClick={() => setMethod('answer')}>
                Security question
              </Chip>
            )}
            <Chip active={method === 'code'} onClick={() => { setMethod('code'); setF({ ...f, code: '' }); }}>
              Code from staff
            </Chip>
          </div>

          {method === 'email' ? (
            <OtpBlock
              key="email"
              sendBody={{ purpose: 'reset', email: who.email, student_id: who.student_id }}
              value={f.code}
              onChange={(code) => setF((x) => ({ ...x, code }))}
              error={fields.code}
            />
          ) : method === 'answer' ? (
            <Field label={info.security_question} error={fields.answer}>
              <Input value={f.answer} onChange={set('answer')} autoComplete="off" placeholder="Your answer" error={fields.answer} />
            </Field>
          ) : (
            <>
              <div className="rounded-2xl border border-peri/30 bg-peri/[.06] p-3 text-sm text-muted">
                Go to the food court counter with your <b className="text-ink">college ID card</b>. Staff will check it and give you a
                6-digit code (valid 15 minutes).
              </div>
              <Field label="6-digit code" error={fields.code}>
                <Input
                  inputMode="numeric"
                  maxLength={7}
                  value={f.code}
                  onChange={(e) => setF({ ...f, code: e.target.value.replace(/[^\d]/g, '') })}
                  placeholder="••••••"
                  className="font-mono text-lg tracking-[.4em]"
                  error={fields.code}
                />
              </Field>
            </>
          )}

          <Field label="New password" error={fields.new_password} hint="At least 8 characters with a letter and a number.">
            <Input type="password" autoComplete="new-password" value={f.new_password} onChange={set('new_password')} error={fields.new_password} />
          </Field>
          <Field label="Confirm new password" error={fields.confirm}>
            <Input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={fields.confirm} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" loading={busy}>
            Verify &amp; set new password
          </Button>
          <button type="button" className="block w-full text-center text-sm text-muted" onClick={() => { setStep(1); setError(null); }}>
            Use a different account
          </button>
        </form>
      )}
    </AuthShell>
  );
}
