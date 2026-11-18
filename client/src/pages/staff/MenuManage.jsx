import { useMemo, useState } from 'react';
import { usePoll } from '../../lib/usePoll.js';
import { api } from '../../lib/api.js';
import { fileToDataUrl, rupees } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  Button, Chip, Empty, ErrorBox, Field, FoodImage, Input, PageLoader, Sheet, Textarea, Toggle, TopBar, VegDot, cx,
} from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';

const CATS = ['Meals', 'Snacks', 'Beverages', 'Breakfast', 'Desserts'];
const EMPTY = { name: '', price: '', category: 'Meals', veg: true, description: '', prep_time: 5, available: true, daily_stock: '' };

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Enter the item name.';
  const p = Number(f.price);
  if (!f.price || !Number.isFinite(p) || p <= 0 || p > 10000) e.price = 'Price between ₹1 and ₹10,000.';
  const t = Number(f.prep_time);
  if (!Number.isInteger(t) || t < 1 || t > 120) e.prep_time = '1–120 minutes.';
  if (f.daily_stock !== '' && (!Number.isInteger(Number(f.daily_stock)) || Number(f.daily_stock) < 0)) e.daily_stock = 'Whole number, or leave empty.';
  return e;
}

function ItemForm({ item, onSaved, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(
    item
      ? { ...item, price: String(item.price), daily_stock: item.daily_stock ?? '', available: item.manual_available }
      : EMPTY
  );
  const [img, setImg] = useState(null); // new data URL
  const [removeImg, setRemoveImg] = useState(false);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const preview = img || (!removeImg && item?.image) || null;

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImg(await fileToDataUrl(file, 480, 0.72));
      setRemoveImg(false);
    } catch (x) {
      toast(x.message, 'error');
    }
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate(f);
    setFields(v);
    setError(null);
    if (Object.keys(v).length) return;
    setBusy(true);
    const body = {
      name: f.name, price: Number(f.price), category: f.category, veg: f.veg, description: f.description,
      prep_time: Number(f.prep_time), available: f.available, daily_stock: f.daily_stock === '' ? null : Number(f.daily_stock),
      image_data: img || undefined, remove_image: removeImg || undefined,
    };
    try {
      const d = item
        ? await api(`/staff/menu/${item.id}`, { method: 'PUT', body })
        : await api('/staff/menu', { method: 'POST', body });
      toast(item ? `${d.item.name} updated` : `${d.item.name} added to the menu`);
      onSaved();
    } catch (x) {
      setFields(x.fields || {});
      setError(x);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl border border-stroke">
          <FoodImage src={preview} name={f.name} className="h-full w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-stroke bg-surface2 px-3 text-sm">
            <Icon name="upload" className="h-4 w-4" /> {preview ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
          </label>
          {preview && (
            <button type="button" className="text-left text-xs text-bad" onClick={() => { setImg(null); setRemoveImg(true); }}>
              Remove photo
            </button>
          )}
        </div>
      </div>
      <Field label="Item name" error={fields.name}>
        <Input value={f.name} onChange={set('name')} placeholder="e.g. Vada Pav" error={fields.name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₹)" error={fields.price}>
          <Input inputMode="decimal" value={f.price} onChange={set('price')} placeholder="40" error={fields.price} />
        </Field>
        <Field label="Prep time (min)" error={fields.prep_time}>
          <Input inputMode="numeric" value={f.prep_time} onChange={set('prep_time')} error={fields.prep_time} />
        </Field>
      </div>
      <Field label="Category" error={fields.category}>
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <Chip key={c} active={f.category === c} onClick={() => setF({ ...f, category: c })}>
              {c}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface2 p-1">
        {[[true, 'Veg'], [false, 'Non-veg']].map(([v, l]) => (
          <button
            key={l}
            type="button"
            onClick={() => setF({ ...f, veg: v })}
            className={cx('flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium', f.veg === v ? 'bg-surface text-ink' : 'text-muted')}
          >
            <VegDot veg={v} /> {l}
          </button>
        ))}
      </div>
      <Field label="Description" error={fields.description}>
        <Textarea maxLength={200} value={f.description} onChange={set('description')} placeholder="What's in it?" />
      </Field>
      <Field label="Daily stock (optional)" error={fields.daily_stock} hint="Leave empty for unlimited. At 0 the item is marked unavailable automatically; it resets every morning.">
        <Input inputMode="numeric" value={f.daily_stock} onChange={set('daily_stock')} placeholder="Unlimited" error={fields.daily_stock} />
      </Field>
      <div className="flex items-center justify-between rounded-2xl bg-surface2 px-4 py-3">
        <div>
          <div className="text-sm font-medium">Available</div>
          <div className="text-xs text-muted">Turn off to show “Unavailable” to students</div>
        </div>
        <Toggle checked={f.available} onChange={(v) => setF({ ...f, available: v })} label="Available" />
      </div>
      <ErrorBox error={error} />
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {item ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}

export default function MenuManage() {
  const { data, error, loading, refresh } = usePoll('/staff/menu', 10000);
  const toast = useToast();
  const [editing, setEditing] = useState(null); // item | 'new' | null
  const [deleting, setDeleting] = useState(null);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  const items = useMemo(
    () =>
      (data?.items || []).filter(
        (i) => (cat === 'All' || i.category === cat) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    [data, cat, q]
  );

  async function toggleAvail(it, on) {
    try {
      await api(`/staff/menu/${it.id}/availability`, { method: 'PATCH', body: { available: on } });
      toast(on ? `${it.name} is available` : `${it.name} marked sold out`, on ? 'success' : 'info');
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function del() {
    try {
      await api(`/staff/menu/${deleting.id}`, { method: 'DELETE' });
      toast(`${deleting.name} deleted`, 'info');
      setDeleting(null);
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <TopBar
        title="Add Food Items"
        subtitle={data ? `${data.items.length} items · ${data.items.filter((i) => !i.available).length} unavailable` : 'Menu'}
        right={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Icon name="plus" className="h-4 w-4" /> Add item
          </Button>
        }
      />
      <div className="px-4 pt-3">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items"
            className="h-11 w-full rounded-2xl border border-stroke bg-surface pl-12 pr-4 outline-none placeholder:text-muted/70 focus:border-lime/60"
          />
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {['All', ...CATS].map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4">
        <ErrorBox error={error} onRetry={refresh} />
        {loading && !data ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <Empty icon="utensils" title="No items" text="Add your first dish to the menu." action={<Button onClick={() => setEditing('new')}>Add item</Button>} />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-3xl border border-stroke bg-surface p-3">
                <FoodImage src={it.image} name={it.name} className={`h-16 w-16 shrink-0 rounded-2xl ${it.available ? '' : 'opacity-40 grayscale'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <VegDot veg={it.veg} />
                    <span className="truncate font-semibold">{it.name}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {rupees(it.price)} · {it.category} · {it.prep_time} min
                  </div>
                  <div className="mt-1 text-xs">
                    {it.stock != null ? (
                      <span className={it.stock === 0 ? 'text-bad' : it.stock <= 5 ? 'text-warn' : 'text-muted'}>
                        {it.stock}/{it.daily_stock} left today
                      </span>
                    ) : (
                      <span className="text-muted">Unlimited</span>
                    )}
                    {!it.available && <span className="ml-2 font-semibold text-bad">Unavailable</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Toggle checked={it.available} onChange={(v) => toggleAvail(it, v)} label={`${it.name} available`} />
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(it)} className="grid h-8 w-8 place-items-center rounded-xl bg-surface2 text-muted hover:text-ink" aria-label="Edit">
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleting(it)} className="grid h-8 w-8 place-items-center rounded-xl bg-surface2 text-muted hover:text-bad" aria-label="Delete">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add food item' : 'Edit item'}>
        {editing && (
          <ItemForm
            key={editing === 'new' ? 'new' : editing.id}
            item={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!deleting} onClose={() => setDeleting(null)} title="Delete item?">
        <p className="text-sm text-muted">
          “{deleting?.name}” will be removed from the menu. Past orders and receipts keep their details.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Keep
          </Button>
          <Button variant="danger" onClick={del}>
            Delete
          </Button>
        </div>
      </Sheet>
    </>
  );
}
