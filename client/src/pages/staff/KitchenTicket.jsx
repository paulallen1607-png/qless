import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePoll } from '../../lib/usePoll.js';
import { time } from '../../lib/format.js';
import PrintShell from '../../components/PrintShell.jsx';
import { ErrorBox, PageLoader } from '../../components/ui.jsx';
import { ticketPdf } from '../../lib/pdf.js';

export default function KitchenTicket() {
  const { id } = useParams();
  const { data, error, loading, refresh } = usePoll(`/orders/${id}`, 60000);
  const [width, setWidth] = useState(() => localStorage.getItem('qless_ticket_width') || '80');

  if (loading && !data) return <PageLoader />;
  if (!data) return <div className="p-4"><ErrorBox error={error} onRetry={refresh} /></div>;
  const o = data.order;
  const narrow = width === '58';

  const pick = (w) => {
    setWidth(w);
    localStorage.setItem('qless_ticket_width', w);
  };

  return (
    <PrintShell
      title={`Kitchen ticket #${o.token}`}
      fileName={`QLess-Ticket-${o.token}-${width}mm.pdf`}
      makePdf={() => ticketPdf(o, data.canteen, Number(width))}
      back="/staff/orders"
      pageCss={`size: ${width}mm 200mm; margin: 2mm;`}
      paperClass="!rounded-none"
      toolbarExtra={
        <div className="flex rounded-xl bg-surface2 p-1 text-sm">
          {['58', '80'].map((w) => (
            <button key={w} onClick={() => pick(w)} className={`rounded-lg px-3 py-1 ${width === w ? 'bg-lime text-bg' : 'text-muted'}`}>
              {w}mm
            </button>
          ))}
        </div>
      }
    >
      <div className="mono p-2 text-black" style={{ width: `${Number(width) - 4}mm`, fontSize: narrow ? 11 : 13, lineHeight: 1.3 }}>
        <div className="text-center font-bold">{data.canteen.canteen_name}</div>
        <div className="text-center" style={{ fontSize: narrow ? 9 : 10 }}>KITCHEN TICKET</div>
        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center font-bold leading-none" style={{ fontSize: narrow ? 40 : 54 }}>
          #{o.token}
        </div>
        <div className="mt-1 flex justify-between" style={{ fontSize: narrow ? 9 : 11 }}>
          <span>{time(o.created_at)}</span>
          <span>{o.student?.student_id}</span>
        </div>
        <div className="my-1 border-t border-dashed border-black" />
        {o.items.map((it) => (
          <div key={it.id} className="flex gap-2 font-bold">
            <span className="shrink-0">{it.qty} x</span>
            <span>
              {it.name}
              {!it.veg && ' (NV)'}
            </span>
          </div>
        ))}
        {o.note && (
          <>
            <div className="my-1 border-t border-dashed border-black" />
            <div className="border-2 border-black p-1 font-bold">NOTE: {o.note}</div>
          </>
        )}
        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center" style={{ fontSize: narrow ? 9 : 10 }}>
          Printed {time(Date.now())} · {o.items.reduce((s, i) => s + i.qty, 0)} items
        </div>
      </div>
    </PrintShell>
  );
}
