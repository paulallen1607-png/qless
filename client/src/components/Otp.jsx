import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Button, ErrorBox, Field, Input } from './ui.jsx';
import { Icon } from './Icon.jsx';

/**
 * "Send code" button + 6-digit input. Sends with POST /auth/otp/send (body = sendBody).
 * If the server has no email service set up yet, it returns the code and it is shown on screen.
 */
export function OtpBlock({ sendBody, value, onChange, error, autoSend = false, label = '6-digit code from your email' }) {
  const [sent, setSent] = useState(null); // { to, demo, demo_code }
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send() {
    setBusy(true);
    setSendErr(null);
    try {
      const d = await api('/auth/otp/send', { method: 'POST', body: sendBody });
      setSent(d);
      setWait(30);
      onChange('');
    } catch (x) {
      setSendErr(x);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoSend) send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {sent ? (
        sent.demo ? (
          <div className="rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
            <div className="flex items-center gap-2 font-semibold">
              <Icon name="alert" className="h-4 w-4" /> Email sending isn't set up on the server yet
            </div>
            <div className="mt-1 text-warn/90">
              Once email is set up, this code is emailed to {sent.to}. For now, your code is{' '}
              <b className="font-mono text-base tracking-widest text-ink" aria-label="Demo code">
                {sent.demo_code}
              </b>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl border border-ok/30 bg-ok/10 p-3 text-sm text-ok">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Code sent to <b>{sent.to}</b>. Check your inbox and spam folder. It's valid for 10 minutes.
            </span>
          </div>
        )
      ) : null}

      {sent && (
        <Field label={label} error={error}>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="••••••"
            className="font-mono text-lg tracking-[.4em]"
            error={error}
          />
        </Field>
      )}

      <ErrorBox error={sendErr} />
      <Button type="button" variant="secondary" size="sm" className="w-full" loading={busy} disabled={wait > 0} onClick={send}>
        <Icon name="bell" className="h-4 w-4" />
        {sent ? (wait > 0 ? `Resend code in ${wait}s` : 'Resend code') : 'Send code to my email'}
      </Button>
    </div>
  );
}

/** Verify the email of an existing account. */
export function VerifyEmailSheet({ open, onClose, onVerified, Sheet, toast }) {
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState(null);
  const [fieldErr, setFieldErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOtp('');
    setErr(null);
    setFieldErr(null);
    onClose();
  };
  async function submit(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setFieldErr('Enter the 6-digit code.');
    setBusy(true);
    setErr(null);
    try {
      const d = await api('/auth/verify-email', { method: 'POST', body: { otp } });
      toast('Email verified.');
      onVerified(d.user);
      close();
    } catch (x) {
      setFieldErr(x.fields?.otp || null);
      setErr(x);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={close} title="Verify your email">
      {open && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <OtpBlock sendBody={{ purpose: 'verify' }} value={otp} onChange={setOtp} error={fieldErr} />
          <ErrorBox error={err} />
          <Button type="submit" className="w-full" loading={busy} disabled={otp.length !== 6}>
            Verify email
          </Button>
        </form>
      )}
    </Sheet>
  );
}
