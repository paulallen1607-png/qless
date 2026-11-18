// Real PDF files for the receipt, kitchen ticket and daily report (pdf-lib, standard fonts).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { encodeQR } from '../shims/qr.js';

const MM = 72 / 25.4;
const black = rgb(0, 0, 0);
const grey = rgb(0.35, 0.35, 0.35);
// Standard PDF fonts only cover Latin-1; swap the rupee sign and drop anything else.
const safe = (s) =>
  String(s ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
const rs = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const dt = (ms) => new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const tm = (ms) => (ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '-');

async function base() {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const monoB = await doc.embedFont(StandardFonts.CourierBold);
  return { doc, reg, bold, mono, monoB };
}

function writer(page, fonts) {
  const W = page.getWidth();
  return {
    text(s, x, y, { size = 10, font = fonts.reg, align = 'left', color = black, maxWidth } = {}) {
      let t = safe(s);
      if (maxWidth) while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -2) + '.';
      const w = font.widthOfTextAtSize(t, size);
      const xx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      page.drawText(t, { x: xx, y, size, font, color });
      return w;
    },
    line(x1, y, x2, { thickness = 0.8, dash } = {}) {
      page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: black, dashArray: dash });
    },
    wrap(s, maxWidth, size, font = fonts.reg) {
      const words = safe(s).split(/\s+/);
      const lines = [];
      let cur = '';
      for (const w of words) {
        const next = cur ? cur + ' ' + w : w;
        if (font.widthOfTextAtSize(next, size) > maxWidth && cur) {
          lines.push(cur);
          cur = w;
        } else cur = next;
      }
      if (cur) lines.push(cur);
      return lines;
    },
    qr(value, x, y, size) {
      const m = encodeQR(value);
      const cell = size / m.length;
      m.forEach((row, r) =>
        row.forEach((on, c) => {
          if (on) page.drawRectangle({ x: x + c * cell, y: y + size - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: black });
        })
      );
    },
    W,
  };
}

const PAY = { verified: 'PAID - Verified', pending: 'Pending verification', rejected: 'Rejected', unpaid: 'Unpaid' };

export async function receiptPdf(order, canteen) {
  const f = await base();
  const page = f.doc.addPage([148 * MM, 210 * MM]); // A5
  const w = writer(page, f);
  const L = 14 * MM;
  const R = w.W - 14 * MM;
  const C = w.W / 2;
  let y = page.getHeight() - 16 * MM;
  w.text((canteen.college_name || '').toUpperCase(), C, y, { size: 12, font: f.bold, align: 'center', maxWidth: R - L });
  y -= 15;
  w.text(canteen.canteen_name, C, y, { size: 10, align: 'center' });
  y -= 13;
  w.text('Food Court Receipt', C, y, { size: 8, align: 'center', color: grey });
  y -= 14;
  w.line(L, y, R, { thickness: 1.6 });
  y -= 16;
  w.text('ORDER TOKEN', C, y, { size: 8, font: f.bold, align: 'center' });
  y -= 44;
  w.text(`#${order.token}`, C, y, { size: 48, font: f.bold, align: 'center' });
  y -= 14;
  w.line(L, y, R, { thickness: 1.6 });
  y -= 18;
  const kv = (k, v) => {
    w.text(k, L, y, { size: 9 });
    w.text(v, R, y, { size: 9, align: 'right', maxWidth: (R - L) * 0.65 });
    y -= 13;
  };
  kv('Date / time', dt(order.created_at));
  kv('Order ID', order.id);
  if (order.student) kv('Student', `${order.student.name} (${order.student.student_id})`);
  y -= 6;
  const cQty = R - 120;
  const cPrice = R - 62;
  w.text('Item', L, y, { size: 9, font: f.bold });
  w.text('Qty', cQty, y, { size: 9, font: f.bold, align: 'right' });
  w.text('Price', cPrice, y, { size: 9, font: f.bold, align: 'right' });
  w.text('Amount', R, y, { size: 9, font: f.bold, align: 'right' });
  y -= 5;
  w.line(L, y, R);
  y -= 13;
  for (const it of order.items) {
    w.text(it.name, L, y, { size: 9, maxWidth: cQty - L - 30 });
    w.text(String(it.qty), cQty, y, { size: 9, align: 'right' });
    w.text(rs(it.price), cPrice, y, { size: 9, align: 'right' });
    w.text(rs(it.price * it.qty), R, y, { size: 9, align: 'right' });
    y -= 13;
  }
  y += 4;
  w.line(L, y, R);
  y -= 16;
  w.text('TOTAL', cPrice, y, { size: 11, font: f.bold, align: 'right' });
  w.text(rs(order.total), R, y, { size: 12, font: f.bold, align: 'right' });
  y -= 14;
  if (order.note) {
    w.text(`Note: ${order.note}`, L, y, { size: 8, maxWidth: R - L });
    y -= 12;
  }
  y -= 4;
  w.line(L, y, R, { dash: [3, 2] });
  const qrSize = 72;
  const top = y - 10;
  y = top - 12;
  const pk = (k, v, boldV) => {
    w.text(k, L, y, { size: 9 });
    w.text(v, L + 92, y, { size: 9, font: boldV ? f.bold : f.reg, maxWidth: R - qrSize - L - 100 });
    y -= 13;
  };
  pk('Payment method', 'UPI', true);
  pk('UPI reference', order.upi_ref || '-', true);
  pk('Payment status', PAY[order.payment_status] || order.payment_status, true);
  pk('Order status', order.status_label || order.status);
  w.qr(`QLESS-ORDER-${order.id}`, R - qrSize, top - qrSize, qrSize);
  w.text(`QLESS-ORDER-${order.id}`, R - qrSize / 2, top - qrSize - 9, { size: 5.5, align: 'center', font: f.mono });
  w.text('Thank you! Show your token at the counter to collect your food.', C, 16 * MM, { size: 8, align: 'center', color: grey });
  return f.doc.save();
}

export async function ticketPdf(order, canteen, widthMm = 80) {
  const f = await base();
  const narrow = widthMm < 70;
  const W = widthMm * MM;
  const pad = 3 * MM;
  const fs = narrow ? 9 : 11;
  // measure height first
  const tmpLines = order.items.reduce((n, it) => n + Math.ceil((safe(it.name).length + 6) / (narrow ? 22 : 28)), 0);
  const noteLines = order.note ? Math.ceil(safe(order.note).length / (narrow ? 22 : 30)) + 1 : 0;
  const H = (narrow ? 120 : 140) + (tmpLines + noteLines) * (fs + 4) + 30;
  const page = f.doc.addPage([W, H]);
  const w = writer(page, f);
  const C = W / 2;
  let y = H - pad - fs;
  w.text(canteen.canteen_name, C, y, { size: fs, font: f.monoB, align: 'center', maxWidth: W - pad * 2 });
  y -= fs + 2;
  w.text('KITCHEN TICKET', C, y, { size: fs - 2, font: f.mono, align: 'center' });
  y -= 8;
  w.line(pad, y, W - pad, { dash: [2, 2] });
  y -= narrow ? 38 : 50;
  w.text(`#${order.token}`, C, y, { size: narrow ? 40 : 54, font: f.monoB, align: 'center' });
  y -= fs + 4;
  w.text(tm(order.created_at), pad, y, { size: fs - 2, font: f.mono });
  w.text(order.student?.student_id || '', W - pad, y, { size: fs - 2, font: f.mono, align: 'right' });
  y -= 7;
  w.line(pad, y, W - pad, { dash: [2, 2] });
  y -= fs + 4;
  for (const it of order.items) {
    const lines = w.wrap(`${it.name}${it.veg ? '' : ' (NV)'}`, W - pad * 2 - 30, fs, f.monoB);
    w.text(`${it.qty} x`, pad, y, { size: fs, font: f.monoB });
    lines.forEach((l, i) => w.text(l, pad + 30, y - i * (fs + 3), { size: fs, font: f.monoB }));
    y -= lines.length * (fs + 3) + 2;
  }
  if (order.note) {
    y -= 2;
    const lines = w.wrap(`NOTE: ${order.note}`, W - pad * 2 - 8, fs, f.monoB);
    const boxH = lines.length * (fs + 3) + 6;
    page.drawRectangle({ x: pad, y: y - boxH + fs + 2, width: W - pad * 2, height: boxH, borderColor: black, borderWidth: 1.5 });
    lines.forEach((l, i) => w.text(l, pad + 4, y - i * (fs + 3), { size: fs, font: f.monoB }));
    y -= boxH + 2;
  }
  y -= 2;
  w.line(pad, y, W - pad, { dash: [2, 2] });
  y -= fs;
  w.text(`Printed ${tm(Date.now())} - ${order.items.reduce((s, i) => s + i.qty, 0)} items`, C, y, { size: fs - 3, font: f.mono, align: 'center' });
  return f.doc.save();
}

export async function reportPdf(r) {
  const f = await base();
  const A4 = [595.28, 841.89];
  let page = f.doc.addPage(A4);
  let w = writer(page, f);
  const L = 36;
  const R = A4[0] - 36;
  let y = A4[1] - 44;
  const longDate = new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  w.text(r.college_name, L, y, { size: 14, font: f.bold, maxWidth: 330 });
  w.text(longDate, R, y, { size: 10, font: f.bold, align: 'right' });
  y -= 15;
  w.text(`${r.canteen_name} - Daily Sales Report`, L, y, { size: 10 });
  w.text(`Generated ${dt(r.generated_at)}`, R, y, { size: 7, align: 'right', color: grey });
  y -= 10;
  w.line(L, y, R, { thickness: 1.6 });
  y -= 14;
  const boxes = [
    ['TOTAL REVENUE', rs(r.total_revenue)],
    ['PAID ORDERS', String(r.paid_orders)],
    ['AVG ORDER VALUE', rs(r.paid_orders ? Math.round((r.total_revenue / r.paid_orders) * 100) / 100 : 0)],
    ['REJECTED PAYMENTS', String(r.rejected_orders)],
  ];
  const bw = (R - L - 18) / 4;
  boxes.forEach(([k, v], i) => {
    const x = L + i * (bw + 6);
    page.drawRectangle({ x, y: y - 36, width: bw, height: 40, borderColor: black, borderWidth: 0.8 });
    w.text(k, x + bw / 2, y - 8, { size: 6.5, align: 'center' });
    w.text(v, x + bw / 2, y - 27, { size: 13, font: f.bold, align: 'center' });
  });
  y -= 56;
  const newPageIfNeeded = (need) => {
    if (y - need > 48) return;
    page = f.doc.addPage(A4);
    w = writer(page, f);
    y = A4[1] - 44;
  };
  const table = (title, cols, rows, size = 8.5) => {
    newPageIfNeeded(40);
    w.text(title, L, y, { size: 10, font: f.bold });
    y -= 14;
    const head = () => {
      cols.forEach((c) => w.text(c.label, c.align === 'right' ? c.x2 : c.x, y, { size, font: f.bold, align: c.align || 'left' }));
      y -= 4;
      w.line(L, y, R, { thickness: 1.1 });
      y -= size + 4;
    };
    head();
    if (!rows.length) {
      w.text('None', L, y, { size, color: grey });
      y -= size + 6;
    }
    for (const row of rows) {
      if (y < 56) {
        page = f.doc.addPage(A4);
        w = writer(page, f);
        y = A4[1] - 44;
        head();
      }
      cols.forEach((c, i) =>
        w.text(row[i], c.align === 'right' ? c.x2 : c.x, y, { size, align: c.align || 'left', maxWidth: c.w, font: c.bold ? f.bold : c.mono ? f.mono : f.reg })
      );
      y -= 3;
      page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
      y -= size + 3;
    }
    y -= 10;
  };
  table(
    'ITEMS SOLD',
    [
      { label: 'Item', x: L, w: 260 },
      { label: 'Unit price', x2: R - 150, align: 'right' },
      { label: 'Qty', x2: R - 80, align: 'right' },
      { label: 'Revenue', x2: R, align: 'right' },
    ],
    r.items_sold.map((it) => [it.name, rs(it.price), String(it.qty), rs(it.revenue)])
  );
  const small = r.orders.length > 40 ? 7.5 : 8.5;
  table(
    'ORDERS',
    [
      { label: 'Token', x: L, bold: true },
      { label: 'Time', x: L + 40 },
      { label: 'Student', x: L + 95, w: 60 },
      { label: 'Items', x: L + 160, w: 175 },
      { label: 'UPI ref', x: L + 340, mono: true },
      { label: 'Status', x: L + 420, w: 55 },
      { label: 'Amount', x2: R, align: 'right' },
    ],
    r.orders.map((o) => [
      `#${o.token}`, tm(o.created_at), o.student?.student_id || '', o.items.map((i) => `${i.qty}x${i.name}`).join(', '), o.upi_ref || '',
      o.status === 'rejected' ? 'Rejected' : o.payment_status === 'verified' ? o.status_label : 'Unverified',
      o.payment_status === 'verified' ? rs(o.total) : '-',
    ]),
    small
  );
  newPageIfNeeded(60);
  w.line(L, y + 6, R, { thickness: 1.6 });
  w.text(`Total revenue: ${rs(r.total_revenue)}`, R, y - 8, { size: 12, font: f.bold, align: 'right' });
  y -= 50;
  w.text('Prepared by: ____________________', L, y, { size: 8 });
  w.text('Verified by: ____________________', R, y, { size: 8, align: 'right' });
  return f.doc.save();
}

/** Hand the file to the viewer (claude.ai downloads capability, or a normal browser download). */
export async function saveFile(filename, bytes) {
  let downloads = null;
  try {
    downloads = window.claude?.use ? await window.claude.use('downloads') : null;
  } catch {
    downloads = null;
  }
  if (downloads) {
    try {
      await downloads.save({ filename, data: new Blob([bytes], { type: 'application/pdf' }) });
      return 'saved';
    } catch (e) {
      if (e?.code === 'declined') return 'declined';
      throw new Error(e?.message || 'Download failed.');
    }
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'saved';
}
