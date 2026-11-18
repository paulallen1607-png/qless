import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../lib/api.js';
import { UPI_RE, buildUpiLink } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Card, ErrorBox, Field, Input, PageLoader, TopBar } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';

export default function PaymentSettings() {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(null);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/staff/settings')
      .then((d) => {
        const v = { upi_id: d.upi_id, canteen_name: d.canteen_name, college_name: d.college_name };
        setF(v);
        setSaved(v);
      })
      .catch(setError);
  }, []);

  if (!f) return (<><TopBar title="Payment settings" back="/staff/profile" />{error ? <div className="p-4"><ErrorBox error={error} /></div> : <PageLoader />}</>);

  const upiValid = UPI_RE.test(f.upi_id.trim());
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const v = {};
    if (!upiValid) v.upi_id = 'UPI ID should look like name@bank (e.g. canteen@okaxis).';
    if (f.canteen_name.trim().length < 2) v.canteen_name = 'Enter a display name.';
    if (f.college_name.trim().length < 2) v.college_name = 'Enter the college name.';
    setFields(v);
    setError(null);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const body = { upi_id: f.upi_id.trim(), canteen_name: f.canteen_name.trim(), college_name: f.college_name.trim() };
      await api('/staff/settings', { method: 'PUT', body });
      setF(body);
      setSaved(body);
      toast('Payment settings saved. New orders will pay to this UPI ID.');
    } catch (x) {
      setFields(x.fields || {});
      setError(x);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Payment settings" back="/staff/profile" subtitle="Where students send UPI payments" />
      <form onSubmit={save} className="grid gap-4 px-4 pt-4 lg:grid-cols-2" noValidate>
        <div className="space-y-4">
          <Card className="flex gap-3 border-peri/30 bg-peri/[.06] text-sm">
            <Icon name="wallet" className="mt-0.5 h-5 w-5 shrink-0 text-peri" />
            <p className="text-muted">
              Every student payment link and QR uses the UPI ID saved here. Changes apply to new orders immediately.
            </p>
          </Card>
          <Field label="Canteen UPI ID" error={fields.upi_id || (f.upi_id && !upiValid ? 'Format: name@bank' : null)} hint="e.g. qlesscanteen@okaxis, 9876543210@ybl">
            <Input
              value={f.upi_id}
              onChange={set('upi_id')}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
              error={fields.upi_id || (f.upi_id && !upiValid)}
            />
          </Field>
          <Field label="Display name (shown in UPI apps)" error={fields.canteen_name}>
            <Input value={f.canteen_name} onChange={set('canteen_name')} maxLength={50} error={fields.canteen_name} />
          </Field>
          <Field label="College name (printed on receipts)" error={fields.college_name}>
            <Input value={f.college_name} onChange={set('college_name')} maxLength={80} error={fields.college_name} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" loading={busy} disabled={!dirty}>
            {dirty ? 'Save settings' : 'Saved'}
          </Button>
        </div>
        <Card className="flex flex-col items-center text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Preview QR</div>
          <div className={`mt-4 rounded-3xl bg-white p-4 ${upiValid ? '' : 'opacity-20'}`}>
            <QRCodeSVG value={buildUpiLink({ upiId: f.upi_id.trim() || 'x@x', payeeName: f.canteen_name || 'Canteen' })} size={200} marginSize={0} />
          </div>
          <div className="mt-3 font-display text-lg font-semibold">{f.canteen_name || '—'}</div>
          <div className="font-mono text-sm text-muted">{f.upi_id || '—'}</div>
          <p className="mt-3 text-xs text-muted">
            Scan with your own UPI app to check the name that appears. Student QRs also include the order amount and token.
          </p>
        </Card>
      </form>
    </>
  );
}
