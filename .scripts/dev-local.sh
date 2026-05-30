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

# Start server in background with an auto-restart loop, so that if the backend
# ever exits (crash, OOM, etc.) it comes back instead of leaving the frontend
# stuck on ECONNREFUSED. The Node server owns its own rotating, size-capped log
# under server/data/logs/ (see server/logger.js), so we deliberately do NOT
# tee into an ever-growing file here; output is just mirrored to this terminal.
mkdir -p "$ROOT/server/data"

(
  while true; do
    echo "[dev-local] starting backend (node index.js) at $(date)"
    (cd "$ROOT/server" && node index.js)
    echo "[dev-local] backend exited (code $?). Restarting in 1s..."
    sleep 1
  done
) &
SERVER_LOOP_PID=$!

cleanup() {
  # Kill the restart loop and any node server it spawned.
  kill "$SERVER_LOOP_PID" 2>/dev/null || true
  pkill -f "$ROOT/server/index.js" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start frontend
cd "$ROOT/platform/app"
cross-env APP_CONFIG=config/local_sqlite.js yarn run dev:fast
