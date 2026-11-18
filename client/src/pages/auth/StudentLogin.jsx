import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell, { RoleBadge, RememberBox } from './AuthShell.jsx';
import { Button, ErrorBox, Field, Input } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function StudentLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.email.trim() || !form.password) return setError(new Error('Enter your email and password.'));
    setBusy(true);
    try {
      const d = await api('/auth/student/login', { method: 'POST', body: form });
      login(d.token, d.user, remember);
      toast(`Welcome back, ${d.user.name.split(' ')[0]}!`);
      const from = loc.state?.from;
      nav(from && from.startsWith('/student') ? from : '/student', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      badge={<RoleBadge />}
      title="Student login"
      subtitle="Use the college email you signed up with."
      footer={
        <>
          New here?{' '}
          <Link to="/student/signup" className="font-semibold text-lime">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="College email">
          <Input type="email" autoComplete="email" placeholder="you@college.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <RememberBox checked={remember} onChange={setRemember} />
          <Link to="/student/forgot" className="font-medium text-lime">
            Forgot password?
          </Link>
        </div>
        <ErrorBox error={error} />
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
