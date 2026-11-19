import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePoll } from '../../lib/usePoll.js';
import { initials, rupees } from '../../lib/format.js';
import { Button, Card, RowLink, Sheet, TopBar } from '../../components/ui.jsx';
import { ChangePasswordSheet, SecurityQuestionSheet } from '../../components/PasswordSheets.jsx';
import { VerifyEmailSheet } from '../../components/Otp.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function StudentProfile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { data } = usePoll('/orders/mine', 30000);
  const [confirm, setConfirm] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [sqOpen, setSqOpen] = useState(false);
  const [veOpen, setVeOpen] = useState(false);
  const toast = useToast();
  const { setUser } = useAuth();
  const me = usePoll('/auth/me', 30000).data?.user || user;
  const paid = (data?.orders || []).filter((o) => o.payment_status === 'verified');

  const rows = [
    ['Email', `${user.email}${me.email_verified ? '  ✓ verified' : ''}`],
    user.student_id && ['Student ID', user.student_id],
    user.dept && ['Department', user.dept],
    user.year && ['Year', `Year ${user.year}`],
  ].filter(Boolean);

  return (
    <>
      <TopBar title="Profile" />
      <div className="space-y-4 px-4 pt-4">
        <Card className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-lime font-display text-2xl font-bold text-bg">{initials(user.name)}</div>
          <div>
            <div className="font-display text-xl font-semibold">{user.name}</div>
            <div className="text-sm text-muted">Student{user.student_id ? ` · ${user.student_id}` : ''}</div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="text-xs text-muted">Orders</div>
            <div className="font-display text-2xl font-semibold">{paid.length}</div>
          </Card>
          <Card>
            <div className="text-xs text-muted">Total spent</div>
            <div className="font-display text-2xl font-semibold">{rupees(paid.reduce((s, o) => s + o.total, 0))}</div>
          </Card>
        </div>
        <Card className="divide-y divide-stroke p-0">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-muted">{k}</span>
              <span className="truncate text-right">{v}</span>
            </div>
          ))}
        </Card>
        {!me.email_verified && (
          <button onClick={() => setVeOpen(true)} className="flex w-full items-center gap-3 rounded-3xl border border-warn/40 bg-warn/10 p-4 text-left text-sm text-warn">
            <span className="flex-1">
              <b>Your email isn't verified yet.</b> Verify it so you can reset your password by email.
            </span>
            <span className="rounded-xl bg-warn px-3 py-1.5 font-semibold text-bg">Verify</span>
          </button>
        )}
        <Card className="divide-y divide-stroke overflow-hidden p-0">
          <RowLink to="/student/orders" icon="receipt" label="Order history" sub="Receipts and past tokens" />
          <RowLink icon="edit" label="Change password" sub="Update your login password" onClick={() => setPwOpen(true)} />
          <RowLink
            icon="alert"
            label="Security question"
            sub={me.has_security_question ? 'Set · used if you forget your password' : 'Not set: add one so you can reset a forgotten password'}
            onClick={() => setSqOpen(true)}
          />
          <RowLink icon="logout" label="Log out" danger onClick={() => setConfirm(true)} />
        </Card>
      </div>
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
      <VerifyEmailSheet open={veOpen} onClose={() => setVeOpen(false)} onVerified={(u) => { setUser(u); window.dispatchEvent(new Event('qless:data')); }} Sheet={Sheet} toast={toast} />
      <SecurityQuestionSheet open={sqOpen} onClose={() => setSqOpen(false)} current={me.security_question} />
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Log out?">
        <p className="text-sm text-muted">Your cart will be cleared on this device.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Stay
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              logout();
              nav('/', { replace: true });
            }}
          >
            Log out
          </Button>
        </div>
      </Sheet>
    </>
  );
}
