import { useState } from 'react';
import { usePoll } from '../../lib/usePoll.js';
import { dateTime, rupees, time, todayKey } from '../../lib/format.js';
import PrintShell from '../../components/PrintShell.jsx';
import { ErrorBox, PageLoader } from '../../components/ui.jsx';
import { reportPdf } from '../../lib/pdf.js';

export default function DailyReport() {
  const [date, setDate] = useState(todayKey());
  const { data, error, loading, refresh } = usePoll(`/staff/report?date=${date}`, 30000);
  const r = data;
  const longDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const many = (r?.orders.length || 0) > 30;

  return (
    <PrintShell
      title="Daily sales report"
      fileName={`QLess-Sales-Report-${date}.pdf`}
      makePdf={r ? () => reportPdf(r) : null}
      back="/staff"
      pageCss="size: A4 portrait; margin: 12mm;"
      paperClass="max-w-[210mm]"
      toolbarExtra={
        <input
          type="date"
          value={date}
          max={todayKey()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-10 rounded-xl border border-stroke bg-surface2 px-3 text-sm text-ink [color-scheme:dark]"
        />
      }
    >
      {loading && !r ? (
        <div className="p-10 text-black">
          <PageLoader />
        </div>
      ) : !r ? (
        <div className="p-6">
          <ErrorBox error={error} onRetry={refresh} />
        </div>
      ) : (
        <div className="p-8 text-black" style={{ fontSize: many ? 10 : 12 }}>
          <div className="flex items-start justify-between border-b-2 border-black pb-3">
            <div>
              <div className="text-lg font-bold">{r.college_name}</div>
              <div>{r.canteen_name} · Daily Sales Report</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{longDate}</div>
              <div className="text-[10px]">Generated {dateTime(r.generated_at)}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3 text-center">
            {[
              ['Total revenue', rupees(r.total_revenue)],
              ['Paid orders', r.paid_orders],
              ['Avg order value', rupees(r.paid_orders ? Math.round((r.total_revenue / r.paid_orders) * 100) / 100 : 0)],
              ['Rejected payments', r.rejected_orders],
            ].map(([k, v]) => (
              <div key={k} className="border border-black p-2">
                <div className="text-[10px] uppercase tracking-wide">{k}</div>
                <div className="text-lg font-bold">{v}</div>
              </div>
            ))}
          </div>

          <h2 className="mb-1 mt-5 font-bold uppercase">Items sold</h2>
          {r.items_sold.length ? (
            <table className="avoid-break">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Unit price</th>
                  <th className="num">Qty</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.items_sold.map((it) => (
                  <tr key={it.name}>
                    <td>{it.name}</td>
                    <td className="num">{rupees(it.price)}</td>
                    <td className="num">{it.qty}</td>
                    <td className="num">{rupees(it.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No paid orders on this date.</p>
          )}

          <h2 className="mb-1 mt-5 font-bold uppercase">Orders</h2>
          {r.orders.length ? (
            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Time</th>
                  <th>Student</th>
                  <th>Items</th>
                  <th>UPI ref</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {r.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-bold">#{o.token}</td>
                    <td>{time(o.created_at)}</td>
                    <td>{o.student?.student_id}</td>
                    <td>{o.items.map((i) => `${i.qty}×${i.name}`).join(', ')}</td>
                    <td className="mono">{o.upi_ref}</td>
                    <td>{o.status === 'rejected' ? 'Rejected' : o.payment_status === 'verified' ? o.status_label : 'Unverified'}</td>
                    <td className="num">{o.payment_status === 'verified' ? rupees(o.total) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No orders on this date.</p>
          )}

          <div className="mt-4 flex justify-end border-t-2 border-black pt-2 text-base font-bold">
            Total revenue: {rupees(r.total_revenue)}
          </div>
          <div className="mt-8 flex justify-between text-[10px]">
            <span>Prepared by: ____________________</span>
            <span>Verified by: ____________________</span>
          </div>
        </div>
      )}
    </PrintShell>
  );
}
