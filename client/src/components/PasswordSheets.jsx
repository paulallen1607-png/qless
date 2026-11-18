import { useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorBox, Field, Input, Select, Sheet } from './ui.jsx';
import { SECURITY_QUESTIONS } from '../lib/constants.js';

/** Change your own password (students) or PIN (staff). */
export function ChangePasswordSheet({ open, onClose, staff }) {
  const toast = useToast();
  const empty = { current_password: '', new_password: '', confirm: '' };
  const [f, setF] = useState(empty);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const word = staff ? 'PIN' : 'password';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const close = () => {
    setF(empty);
    setFields({});
    setError(null);
    onClose();
  };

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!f.current_password) v.current_password = `Enter your current ${word}.`;
    if (staff ? f.new_password.length < 4 : f.new_password.length < 8 || !/[A-Za-z]/.test(f.new_password) || !/\d/.test(f.new_password)) {
      v.new_password = staff ? 'At least 4 characters.' : 'At least 8 characters with a letter and a number.';
    }
    if (f.confirm !== f.new_password) v.confirm = `New ${word}s don't match.`;
    setFields(v);
    setError(null);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: f });
      toast(`${staff ? 'PIN' : 'Password'} changed.`);
      close();
    } catch (x) {
      setFields(x.fields || {});
      setError(x);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title={`Change ${word}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={`Current ${word}`} error={fields.current_password}>
          <Input type="password" autoComplete="current-password" value={f.current_password} onChange={set('current_password')} error={fields.current_password} />
        </Field>
        <Field label={`New ${word}`} error={fields.new_password} hint={staff ? 'At least 4 characters.' : 'At least 8 characters with a letter and a number.'}>
          <Input type="password" autoComplete="new-password" value={f.new_password} onChange={set('new_password')} error={fields.new_password} />
        </Field>
        <Field label={`Confirm new ${word}`} error={fields.confirm}>
          <Input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={fields.confirm} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" className="w-full" loading={busy}>
          Save new {word}
        </Button>
      </form>
    </Sheet>
  );
}

/** Staff tool: after checking the student's ID card, give them a one-time reset code. */
export function ResetStudentSheet({ open, onClose }) {
  const [sid, setSid] = useState('');
  const [result, setResult] = useState(null);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setSid('');
    setResult(null);
    setFields({});
    setError(null);
    onClose();
  };

  async function submit(e) {
    e.preventDefault();
    if (!sid.trim()) return setFields({ student_id: 'Enter the student ID or email.' });
    setFields({});
    setError(null);
    setBusy(true);
    try {
      setResult(await api('/staff/reset-code', { method: 'POST', body: { student_id: sid } }));
    } catch (x) {
      setFields(x.fields || {});
      setError(x);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Student password reset">
      {result ? (
        <div className="text-center">
          <p className="text-sm text-muted">
            Reset code for <b className="text-ink">{result.name}</b> ({result.student_id})
          </p>
          <div className="my-4 rounded-3xl bg-surface2 py-5 font-mono text-5xl font-bold tracking-[.25em] text-lime" aria-label="Reset code">
            {result.code}
          </div>
          <p className="text-sm text-muted">
            Tell the student this code. They enter it under <b className="text-ink">Forgot password? → Code from staff</b> and choose
            their own new password. It works once and expires at{' '}
            {new Date(result.expires).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.
          </p>
          <Button className="mt-5 w-full" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="rounded-2xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
            First check the student's <b>college ID card</b> matches the account. Only then give them a code.
          </div>
          <Field label="Student ID or college email" error={fields.student_id}>
            <Input placeholder="21CS045" className="uppercase" value={sid} onChange={(e) => setSid(e.target.value)} error={fields.student_id} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" variant="peri" className="w-full" loading={busy}>
            I've checked the ID card. Generate code
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** Student: set or change the security question used to reset a forgotten password. */
export function SecurityQuestionSheet({ open, onClose, current }) {
  const toast = useToast();
  const empty = { current_password: '', question: current || '', answer: '' };
  const [f, setF] = useState(empty);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const close = () => {
    setF(empty);
    setFields({});
    setError(null);
    onClose();
  };

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!f.current_password) v.current_password = 'Enter your current password.';
    if (!f.question) v.question = 'Pick a question.';
    if (f.answer.trim().length < 2) v.answer = 'Answer must be at least 2 characters.';
    setFields(v);
    setError(null);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api('/auth/security-question', { method: 'POST', body: f });
      toast('Security question saved.');
      close();
      window.dispatchEvent(new Event('qless:data'));
    } catch (x) {
      setFields(x.fields || {});
      setError(x);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Security question">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-muted">If you forget your password, you'll answer this to prove it's you.</p>
        <Field label="Question" error={fields.question}>
          <Select value={f.question} onChange={set('question')} error={fields.question}>
            <option value="">Choose a question…</option>
            {SECURITY_QUESTIONS.map((q) => (
              <option key={q}>{q}</option>
            ))}
          </Select>
        </Field>
        <Field label="Answer" error={fields.answer} hint="Not case-sensitive.">
          <Input value={f.answer} onChange={set('answer')} autoComplete="off" error={fields.answer} />
        </Field>
        <Field label="Current password" error={fields.current_password}>
          <Input type="password" autoComplete="current-password" value={f.current_password} onChange={set('current_password')} error={fields.current_password} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" className="w-full" loading={busy}>
          Save security question
        </Button>
      </form>
    </Sheet>
  );
}
