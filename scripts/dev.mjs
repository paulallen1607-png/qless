// Developer mode: rebuilds the app screens, then runs the server and restarts it when server code changes.
// (Needs "npm run build" once, so the client build tools are installed.)
import { spawn, spawnSync } from 'node:child_process';
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`QLess needs Node.js 22.13 or newer. You have ${process.versions.node}.`);
  process.exit(1);
}
const b = spawnSync(process.execPath, ['build.mjs'], { cwd: new URL('../client/', import.meta.url), stdio: 'inherit' });
if (b.status !== 0) process.exit(b.status || 1);
spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--watch-path=src', 'src/index.js'], {
  cwd: new URL('../server/', import.meta.url),
  stdio: 'inherit',
});
