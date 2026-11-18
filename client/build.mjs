// Builds the QLess client into ONE file: client/dist/index.html (served by the QLess server).
// Usage: node build.mjs        (needs: npm install, once)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
// Resolve tools from this project's node_modules (or a fallback toolbox folder if given).
const bases = [ROOT, ...(process.env.QLESS_TOOLS ? [process.env.QLESS_TOOLS] : [])];
function find(mod) {
  for (const b of bases) {
    try {
      return createRequire(path.join(b, 'x.js')).resolve(mod);
    } catch {
      /* try next */
    }
  }
  throw new Error(`Missing "${mod}". Run "npm install" in the client folder first.`);
}
const require = createRequire(find('esbuild'));
const esbuild = require('esbuild');
const twDir = path.dirname(find('tailwindcss/package.json'));
const { compile } = await import(pathToFileURL(path.join(twDir, 'dist/lib.mjs')).href);
const nodePaths = bases.map((b) => path.join(b, 'node_modules')).concat(bases);

const res = await esbuild.build({
  entryPoints: [path.join(SRC, 'main.jsx')],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  nodePaths,
  alias: {
    'react-router-dom': path.join(SRC, 'shims/router.jsx'),
    'qrcode.react': path.join(SRC, 'shims/qrcode-react.jsx'),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const tw = await compile(fs.readFileSync(path.join(SRC, 'index.css'), 'utf8'), {
  base: SRC,
  loadStylesheet: async (id, base) => ({ path: id, base, content: fs.readFileSync(path.join(twDir, 'index.css'), 'utf8') }),
});
const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
walk(SRC);
const cands = new Set();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/[^\s"'`{}<>]+/g)) cands.add(m[0]);
const css = (await esbuild.transform(tw.build([...cands]), { loader: 'css', minify: true })).code;

const favicon = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<link rel="icon"[^>]*>/)?.[0] || '';
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0A0C12" />
<title>QLess · College Food Court</title>
${favicon}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), html);
console.log(`Built client/dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
