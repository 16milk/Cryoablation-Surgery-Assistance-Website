#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Install server deps if needed
if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd "$ROOT/server" && yarn install)
fi

echo "Starting MedView local dev (SQLite server + frontend)..."
echo "  Backend:  http://localhost:5100"
echo "  Frontend: http://localhost:3000"
echo ""

# Start server in background
(cd "$ROOT/server" && node index.js) &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start frontend
cd "$ROOT/platform/app"
cross-env APP_CONFIG=config/local_sqlite.js yarn run dev:fast
