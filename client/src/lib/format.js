export const rupees = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const time = (ms) =>
  ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—';

export const dateTime = (ms) =>
  ms
    ? new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

export const shortDate = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return shortDate(ms);
}

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export const itemCount = (items) => items.reduce((s, i) => s + i.qty, 0);

export const todayKey = () => new Date().toLocaleDateString('en-CA');

export const minutes = (m) => (m == null ? '—' : m < 1 ? '<1 min' : `${Math.round(m)} min`);

export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function buildUpiLink({ upiId, payeeName, amount, token }) {
  const p = [`pa=${upiId}`, `pn=${encodeURIComponent(payeeName)}`];
  if (amount != null) p.push(`am=${Number(amount).toFixed(2)}`);
  p.push('cu=INR');
  if (token != null) p.push(`tn=${encodeURIComponent(`QLess Order ${token}`)}`);
  return `upi://pay?${p.join('&')}`;
}

/** Resize an image file to a JPEG data URL (keeps uploads small). */
export function fileToDataUrl(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error('Choose a JPG, PNG or WEBP image.'));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('That image is too large (max 15 MB).'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}
