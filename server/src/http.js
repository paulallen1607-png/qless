import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { HttpError } from './util.js';
import { UPLOAD_DIR } from './db.js';

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function readJson(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'That upload is too large. Try a smaller image.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      let data;
      try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reject(new HttpError(400, 'Invalid request body.'));
      }
      // Every endpoint expects a JSON object; anything else (null, arrays, numbers, text) is rejected.
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return reject(new HttpError(400, 'Invalid request body.'));
      }
      resolve(data);
    });
    req.on('error', reject);
  });
}

/** Minimal router. Handlers run in order; a handler that returns a value ends the chain. */
export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, ...handlers) => {
    const keys = [];
    const re = new RegExp(
      '^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => (keys.push(k), '/([^/]+)')) + '/?$'
    );
    routes.push({ method, re, keys, handlers });
  };
  return {
    get: add('GET'),
    post: add('POST'),
    put: add('PUT'),
    patch: add('PATCH'),
    delete: add('DELETE'),
    async handle(req, res, pathname) {
      let pathMatched = false;
      for (const r of routes) {
        const m = pathname.match(r.re);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== req.method) continue;
        req.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        for (const h of r.handlers) {
          const out = await h(req, res);
          if (res.writableEnded) return true;
          if (out !== undefined) {
            sendJson(res, 200, out);
            return true;
          }
        }
        sendJson(res, 200, { ok: true });
        return true;
      }
      if (pathMatched) throw new HttpError(405, 'Method not allowed.');
      return false;
    },
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

/** Serve a file from inside baseDir (no path traversal). Returns true if served. */
export function serveStatic(res, baseDir, relPath, { cache = false } = {}) {
  const full = path.resolve(baseDir, '.' + path.posix.normalize('/' + relPath));
  if (!full.startsWith(path.resolve(baseDir))) return false;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': cache ? 'public, max-age=86400' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(full).pipe(res);
  return true;
}

/** Save a base64 data URL image (jpeg/png/webp) to /uploads. Returns its public path. */
export function saveDataUrlImage(dataUrl, maxBytes = 3 * 1024 * 1024) {
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new HttpError(400, 'Image must be a JPG, PNG or WEBP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxBytes) throw new HttpError(413, 'Image is too large (max 3 MB).');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

export function deleteUpload(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/') || publicPath.includes('/seed-')) return;
  const full = path.join(UPLOAD_DIR, path.basename(publicPath));
  fs.rm(full, { force: true }, () => {});
}
