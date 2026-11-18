import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { usePoll } from '../../lib/usePoll.js';
import { dateTime, rupees } from '../../lib/format.js';
import PrintShell from '../../components/PrintShell.jsx';
import { ErrorBox, PageLoader } from '../../components/ui.jsx';
import { receiptPdf } from '../../lib/pdf.js';

const PAY_LABEL = { verified: 'PAID · Verified', pending: 'Pending verification', rejected: 'Rejected', unpaid: 'Unpaid' };

export function ReceiptDoc({ order, canteen }) {
  return (
    <div className="p-8 text-[13px] leading-snug">
      <div className="text-center">
        <div className="text-base font-bold uppercase tracking-wide">{canteen.college_name}</div>
        <div className="text-sm">{canteen.canteen_name}</div>
        <div className="mt-1 text-xs">Food Court Receipt</div>
      </div>

      <div className="my-5 border-y-2 border-black py-3 text-center">
        <div className="text-xs font-semibold uppercase tracking-[.3em]">Order token</div>
        <div className="font-display text-6xl font-bold leading-none">#{order.token}</div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>Date / time</div>
        <div className="text-right">{dateTime(order.created_at)}</div>
        <div>Order ID</div>
        <div className="mono text-right">{order.id}</div>
        {order.student && (
          <>
            <div>Student</div>
            <div className="text-right">
              {order.student.name} ({order.student.student_id})
            </div>
          </>
        )}
      </div>

      <table className="mt-4">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td className="num">{it.qty}</td>
              <td className="num">{rupees(it.price)}</td>
              <td className="num">{rupees(it.price * it.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-2 text-right font-bold" style={{ borderBottom: 0 }}>
              TOTAL
            </td>
            <td className="num pt-2 text-base font-bold" style={{ borderBottom: 0 }}>
              {rupees(order.total)}
            </td>
          </tr>
        </tfoot>
      </table>
      {order.note && <div className="mt-2 text-xs">Note: {order.note}</div>}

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-dashed border-black pt-4">
        <div className="space-y-1 text-xs">
          <div>
            Payment method: <b>UPI</b>
          </div>
          <div>
            UPI reference: <b className="mono">{order.upi_ref || '—'}</b>
          </div>
          <div>
            Payment status: <b>{PAY_LABEL[order.payment_status] || order.payment_status}</b>
          </div>
          <div>
            Order status: <b>{order.status_label}</b>
          </div>
        </div>
        <div className="text-center">
          <QRCodeSVG value={`QLESS-ORDER-${order.id}`} size={88} level="M" marginSize={0} />
          <div className="mono mt-1 text-[9px]">QLESS-ORDER-{order.id}</div>
        </div>
      </div>
      <div className="mt-6 text-center text-[11px]">Thank you! Show your token at the counter to collect your food.</div>
    </div>
  );
}

export default function Receipt() {
  const { id } = useParams();
  const { data, error, loading, refresh } = usePoll(`/orders/${id}`, 30000);
  if (loading && !data) return <PageLoader />;
  if (!data) return <div className="p-4"><ErrorBox error={error} onRetry={refresh} /></div>;
  return (
    <PrintShell
      title={`Receipt #${data.order.token}`}
      fileName={`QLess-Receipt-${data.order.order_date}-Token-${data.order.token}.pdf`}
      makePdf={() => receiptPdf(data.order, data.canteen)}
      pageCss="size: A5 portrait; margin: 10mm;"
      paperClass="max-w-[148mm]"
    >
      <ReceiptDoc order={data.order} canteen={data.canteen} />
    </PrintShell>
  );
}
