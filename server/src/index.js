import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ROOT, UPLOAD_DIR } from './db.js';
import { sendJson, readJson, serveStatic } from './http.js';
import { seed, fixSampleUpi } from './seed.js';
import { expireStaleDrafts } from './services.js';
import router from './routes.js';

const PORT = Number(process.env.PORT || 4000);
const CLIENT_DIST = path.resolve(ROOT, '../client/dist');

if (seed()) console.log('First run: demo data seeded (see README for logins).');
fixSampleUpi();
setInterval(() => {
  try {
    expireStaleDrafts();
  } catch (e) {
    console.error(e);
  }
}, 60000).unref();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    if (pathname.startsWith('/api/')) {
      req.query = url.searchParams;
      req.body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readJson(req) : {};
      const handled = await router.handle(req, res, pathname);
      if (!handled) sendJson(res, 404, { error: 'Not found.' });
      return;
    }
    if (pathname.startsWith('/uploads/') && req.method === 'GET') {
      if (serveStatic(res, UPLOAD_DIR, pathname.slice('/uploads/'.length), { cache: true })) return;
      return sendJson(res, 404, { error: 'File not found.' });
    }
    // Production: serve the built client (npm run build) with SPA fallback.
    if (req.method === 'GET' && fs.existsSync(CLIENT_DIST)) {
      if (pathname !== '/' && serveStatic(res, CLIENT_DIST, pathname, { cache: pathname.startsWith('/assets/') })) return;
      if (serveStatic(res, CLIENT_DIST, 'index.html')) return;
    }
    sendJson(res, 404, { error: 'Not found. In development, open the Vite URL (http://localhost:5173).' });
  } catch (e) {
    if (!e.status || e.status >= 500) console.error(e);
    if (res.headersSent) return res.end();
    sendJson(res, e.status || 500, {
      error: e.status ? e.message : 'Something went wrong on our side. Please try again.',
      ...(e.fields ? { fields: e.fields } : {}),
    });
  }
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. QLess may already be running. Close the other window, or set PORT to another number.\n`);
  } else {
    console.error('Server error:', e.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const hasClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
  console.log('\n  QLess is running.\n');
  console.log(`  On this computer:   http://localhost:${PORT}`);
  for (const ip of lanAddresses()) console.log(`  On phones (same Wi-Fi): http://${ip}:${PORT}`);
  if (!hasClient) console.log('\n  (App screens not built yet: run "npm run build" first.)');
  console.log('\n  Keep this window open while using QLess. Press Ctrl+C to stop.\n');
});

// Never crash on a stray error: log it and keep serving.
process.on('unhandledRejection', (e) => console.error('Unhandled error:', e));
process.on('uncaughtException', (e) => console.error('Unexpected error:', e));
