import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { saveFile } from '../lib/pdf.js';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Wraps a printable document: dark backdrop, a toolbar, and a white "paper" preview.
 * "Download PDF" builds a real PDF with the same layout (makePdf returns bytes).
 */
export default function PrintShell({ title, paperClass = '', toolbarExtra, back, children, makePdf, fileName }) {
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!makePdf) return;
    setBusy(true);
    try {
      const bytes = await makePdf();
      const r = await saveFile(fileName || 'qless.pdf', bytes);
      if (r === 'saved') toast('PDF ready. Open it to print or share.');
    } catch (e) {
      toast(e.message || 'Could not create the PDF.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="print-root min-h-dvh bg-bg px-3 pb-10 pt-3">
      <div className="no-print sticky top-3 z-10 mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-stroke bg-surface/95 p-2 backdrop-blur">
        <button onClick={() => (back ? nav(back) : nav(-1))} className="grid h-10 w-10 place-items-center rounded-xl bg-surface2" aria-label="Back">
          <Icon name="back" />
        </button>
        <span className="mr-auto font-display font-semibold">{title}</span>
        {toolbarExtra}
        <button
          onClick={download}
          disabled={busy || !makePdf}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-semibold text-bg disabled:opacity-50"
        >
          <Icon name="printer" className="h-4 w-4" /> {busy ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
      <p className="no-print mx-auto mb-3 max-w-3xl text-center text-xs text-muted">
        Download the PDF, then open it to print (A5 receipt · 58/80 mm thermal ticket · A4 report).
      </p>
      <div className={`paper mx-auto rounded-lg shadow-2xl shadow-black/40 ${paperClass}`}>{children}</div>
    </div>
  );
}
