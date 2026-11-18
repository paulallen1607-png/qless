import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthShell, { RoleBadge, RememberBox } from './AuthShell.jsx';
import { Button, ErrorBox, Field, Input } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function StaffLogin() {
  const [form, setForm] = useState({ staff_id: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.staff_id.trim() || !form.password) return setError(new Error('Enter your staff ID and PIN/password.'));
    setBusy(true);
    try {
      const d = await api('/auth/staff/login', { method: 'POST', body: form });
      login(d.token, d.user, remember);
      toast(`Signed in as ${d.user.name}`);
      nav('/staff', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      badge={<RoleBadge staff />}
      title="Staff login"
      subtitle="Staff accounts are created by the canteen admin."
      footer="Forgot your PIN? Ask the canteen manager. Logged-in staff can change their PIN from Profile."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Staff ID">
          <Input autoComplete="username" placeholder="STAFF01" className="uppercase" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} />
        </Field>
        <Field label="PIN / password">
          <Input type="password" autoComplete="current-password" placeholder="••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <RememberBox checked={remember} onChange={setRemember} />
        <ErrorBox error={error} />
        <Button type="submit" variant="peri" className="w-full" loading={busy}>
          Log in to counter
        </Button>
      </form>
    </AuthShell>
  );
}
