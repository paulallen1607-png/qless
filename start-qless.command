#!/bin/sh
# Start QLess on Mac or Linux: double-click (Mac) or run ./start-qless.sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  exit 1
fi
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || {
  echo "Your Node.js is too old. QLess needs 22.13 or newer: https://nodejs.org"; exit 1; }
( sleep 3; (open http://localhost:4000 2>/dev/null || xdg-open http://localhost:4000 2>/dev/null) ) &
exec node --disable-warning=ExperimentalWarning server/src/index.js
