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

# Optionally start the MedSAM2 inference service (lung-ct-compare segmentation).
# Opt-in: only runs if its virtualenv exists, so the default flow is unaffected.
# When it's not running, the frontend falls back to in-browser HU thresholds.
MEDSAM2_LOOP_PID=""
MEDSAM2_DIR="$ROOT/medsam2_server"
if [ -x "$MEDSAM2_DIR/.venv/bin/python" ]; then
  echo "  MedSAM2:  http://localhost:5200 (starting)"
  (
    while true; do
      echo "[dev-local] starting MedSAM2 service at $(date)"
      (cd "$MEDSAM2_DIR" && ./.venv/bin/python app.py)
      echo "[dev-local] MedSAM2 exited (code $?). Restarting in 2s..."
      sleep 2
    done
  ) &
  MEDSAM2_LOOP_PID=$!
else
  echo "  MedSAM2:  disabled (no medsam2_server/.venv — see medsam2_server/README.md)"
fi

cleanup() {
  # Kill the restart loops and any servers they spawned.
  kill "$SERVER_LOOP_PID" 2>/dev/null || true
  [ -n "$MEDSAM2_LOOP_PID" ] && kill "$MEDSAM2_LOOP_PID" 2>/dev/null || true
  pkill -f "$ROOT/server/index.js" 2>/dev/null || true
  pkill -f "$MEDSAM2_DIR/app.py" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start frontend
cd "$ROOT/platform/app"
cross-env APP_CONFIG=config/local_sqlite.js yarn run dev:fast
