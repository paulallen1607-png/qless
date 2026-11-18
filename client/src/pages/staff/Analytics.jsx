import { useState } from 'react';
import { usePoll } from '../../lib/usePoll.js';
import { minutes, rupees } from '../../lib/format.js';
import { Card, Chip, Empty, ErrorBox, PageLoader, Stat, TopBar } from '../../components/ui.jsx';

/** Single-series vertical bar chart with hover/tap tooltips. */
function BarChart({ data, valueKey, labelKey, format = (v) => v, tooltip, height = 160, highlightMax = true }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const peak = data.reduce((m, d, i) => (d[valueKey] > (data[m]?.[valueKey] ?? -1) ? i : m), 0);
  const ticks = [max, Math.round(max / 2)];
  return (
    <div className="relative">
      <div className="relative flex gap-1" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-stroke/70" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[10px] text-muted">{format(t)}</span>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-stroke" />
        {data.map((d, i) => {
          const v = d[valueKey];
          const h = (v / max) * 100;
          const active = hover === i;
          return (
            <button
              key={i}
              type="button"
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(i)}
              aria-label={tooltip(d)}
            >
              <span
                className={`w-full max-w-7 rounded-t-[4px] transition ${
                  v === 0 ? 'bg-transparent' : highlightMax && i === peak ? 'bg-lime' : active ? 'bg-lime/80' : 'bg-lime/45'
                }`}
                style={{ height: v ? `max(${h}%, 3px)` : 0 }}
              />
              {active && (
                <span className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-stroke bg-surface2 px-2 py-1 text-xs shadow-lg">
                  {tooltip(d)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-muted">
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

const hourLabel = (h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

export default function Analytics() {
  const [range, setRange] = useState('week');
  const { data, error, loading, refresh } = usePoll(`/staff/analytics?range=${range}`, 30000);

  if (loading && !data) return (<><TopBar title="Analytics" /><PageLoader /></>);
  if (!data) return (<><TopBar title="Analytics" /><div className="p-4"><ErrorBox error={error} onRetry={refresh} /></div></>);

  const used = data.peak_hours.filter((h) => h.orders > 0).map((h) => h.hour);
  const from = Math.min(7, ...used);
  const to = Math.max(21, ...used);
  const hours = data.peak_hours.filter((h) => h.hour >= from && h.hour <= to).map((h) => ({ ...h, label: h.hour % 2 === 0 ? hourLabel(h.hour) : '' }));
  const busiest = data.peak_hours.reduce((m, h) => (h.orders > m.orders ? h : m), { orders: 0 });
  const daily = data.daily.map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }),
  }));
  const topQty = Math.max(1, ...data.best_sellers.map((b) => b.qty));

  return (
    <>
      <TopBar title="Analytics" subtitle="Paid orders only" />
      <div className="flex gap-2 px-4 pt-3">
        <Chip active={range === 'today'} onClick={() => setRange('today')}>Today</Chip>
        <Chip active={range === 'week'} onClick={() => setRange('week')}>This week</Chip>
      </div>
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={range === 'today' ? 'Orders today' : 'Orders (7 days)'} icon="bag" value={data.total_orders} />
          <Stat label="Revenue today" icon="rupee" value={rupees(data.revenue_today)} accent="text-lime" />
          <Stat label="Revenue this week" icon="chart" value={rupees(data.revenue_week)} />
          <Stat label="Avg service time" icon="clock" value={minutes(data.avg_service_minutes)} sub={data.avg_wait_minutes != null ? `avg confirm→collect ${minutes(data.avg_wait_minutes)}` : 'start → ready'} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display font-semibold">Peak hours</h2>
              <span className="text-xs text-muted">
                {busiest.orders ? `Busiest: ${hourLabel(busiest.hour)}–${hourLabel((busiest.hour + 1) % 24)}` : 'No orders yet'}
              </span>
            </div>
            {data.total_orders ? (
              <BarChart data={hours} valueKey="orders" labelKey="label" tooltip={(d) => `${hourLabel(d.hour)}: ${d.orders} order${d.orders === 1 ? '' : 's'}`} />
            ) : (
              <Empty icon="chart" title="No paid orders in this range" />
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display font-semibold">Revenue, last 7 days</h2>
              <span className="text-xs text-muted">{rupees(data.revenue_week)} total</span>
            </div>
            <BarChart data={daily} valueKey="revenue" labelKey="label" format={(v) => `₹${v}`} highlightMax={false} tooltip={(d) => `${d.label}: ${rupees(d.revenue)} · ${d.orders} orders`} />
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-display font-semibold">Best-selling items</h2>
          {data.best_sellers.length === 0 ? (
            <p className="text-sm text-muted">No sales in this range yet.</p>
          ) : (
            <ol className="space-y-3">
              {data.best_sellers.map((b, i) => (
                <li key={b.name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>
                      <span className="mr-2 font-display text-muted">{i + 1}</span>
                      {b.name}
                    </span>
                    <span className="text-muted">
                      <span className="font-semibold text-ink">{b.qty}</span> sold · {rupees(b.revenue)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-peri" style={{ width: `${(b.qty / topQty) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
