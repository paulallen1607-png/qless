import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../lib/format.js';
import { Button, Card, RowLink, Sheet, TopBar } from '../../components/ui.jsx';
import { ChangePasswordSheet, ResetStudentSheet } from '../../components/PasswordSheets.jsx';

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <>
      <TopBar title="Staff profile" />
      <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        <Card className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-peri font-display text-2xl font-bold text-bg">{initials(user.name)}</div>
          <div>
            <div className="font-display text-xl font-semibold">{user.name}</div>
            <div className="text-sm text-muted">Staff · {user.staff_id}</div>
          </div>
        </Card>
        <Card className="divide-y divide-stroke overflow-hidden p-0">
          <RowLink to="/staff/payment" icon="wallet" label="Payment settings" sub="Canteen UPI ID, display name, QR preview" />
          <RowLink to="/staff/menu" icon="utensils" label="Add food items" sub="Menu, prices, stock, availability" />
          <RowLink to="/staff/report" icon="file" label="Daily sales report" sub="Printable A4 report" />
          <RowLink to="/staff/analytics" icon="chart" label="Analytics" sub="Peak hours, revenue, best sellers" />
          <RowLink icon="users" label="Student password reset" sub="Check ID card, then give a one-time code" onClick={() => setResetOpen(true)} />
          <RowLink icon="edit" label="Change my PIN" sub="Update your staff login PIN" onClick={() => setPinOpen(true)} />
        </Card>
        <Card className="overflow-hidden p-0">
          <RowLink icon="logout" label="Log out" danger onClick={() => setConfirm(true)} />
        </Card>
      </div>
      <ChangePasswordSheet staff open={pinOpen} onClose={() => setPinOpen(false)} />
      <ResetStudentSheet open={resetOpen} onClose={() => setResetOpen(false)} />
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Log out?">
        <p className="text-sm text-muted">You'll need your staff ID and PIN to sign back in.</p>
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
