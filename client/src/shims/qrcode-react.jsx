import { useMemo } from 'react';
import { encodeQR } from './qr.js';

/** Drop-in for qrcode.react's QRCodeSVG (value, size, marginSize). */
export function QRCodeSVG({ value, size = 128, marginSize = 0, bgColor = '#ffffff', fgColor = '#000000' }) {
  const { path, n } = useMemo(() => {
    const m = encodeQR(String(value));
    let d = '';
    m.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x + marginSize},${y + marginSize}h1v1h-1z`;
      })
    );
    return { path: d, n: m.length + marginSize * 2 };
  }, [value, marginSize]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="QR code">
      <rect width={n} height={n} fill={bgColor} />
      <path d={path} fill={fgColor} />
    </svg>
  );
}
